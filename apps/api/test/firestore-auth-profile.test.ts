import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createFirestoreApp } from "../src/firestore/app.js";
import { demoIds, seedFirestoreDemo } from "../src/firestore/seed.js";
import { hash } from "../src/firestore/context.js";

const host = process.env.FIRESTORE_EMULATOR_HOST;
const opts = {
  skip: host
    ? false
    : "Actual Firestore emulator required: set FIRESTORE_EMULATOR_HOST and DATABASE_MODE=firestore-emulator. No mock/cloud fallback.",
};
async function fixture(extra: Record<string, any> = {}) {
  const dir = await mkdtemp(join(tmpdir(), "gap-firestore-auth-")),
    namespace = `test-${randomUUID()}`;
  const options = {
    projectId: "demo-app-cuoi-ky",
    emulatorHost: host,
    namespace,
    dataDir: dir,
    demoMode: true,
    seedDemo: true,
    ...extra,
  };
  const app = await createFirestoreApp(options);
  const call = (method: any, url: string, token?: string, payload?: any) =>
    app.inject({
      method,
      url,
      headers: token ? { authorization: `Bearer ${token}` } : {},
      ...(payload === undefined ? {} : { payload }),
    });
  const login = async (account: string) =>
    (await call("POST", "/v1/demo/sessions", undefined, { account })).json()
      .data;
  return {
    app,
    dir,
    options,
    call,
    login,
    close: async () => {
      await app.firestore.db.recursiveDelete(app.firestore.root);
      await app.close();
      await rm(dir, { recursive: true, force: true });
    },
  };
}
function multipart(bytes: Buffer, mime = "image/png") {
  const boundary = "gap-firestore-boundary";
  return {
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload: Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="image.png"\r\nContent-Type: ${mime}\r\n\r\n`
      ),
      bytes,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  };
}
async function upload(
  f: Awaited<ReturnType<typeof fixture>>,
  token: string,
  bytes: Buffer,
  url = "/v1/me/media",
  mime = "image/png"
) {
  const part = multipart(bytes, mime);
  return f.app.inject({
    method: "POST",
    url,
    ...part,
    headers: { ...part.headers, authorization: `Bearer ${token}` },
  });
}

test(
  "Firestore auth: session hashes, logout, expiry and explicit demo gate",
  opts,
  async () => {
    let now = Date.UTC(2026, 10, 1);
    const f = await fixture({ now: () => now, sessionTtlMs: 1000 });
    try {
      assert.equal(f.app.firestore.database.mode, "emulator");
      const a = await f.login("A"),
        stored = (
          await f.app.firestore.ref("sessions", hash(a.token)).get()
        ).data()!;
      assert.equal(stored.userId, demoIds.A);
      assert.ok(!JSON.stringify(stored).includes(a.token));
      assert.equal((await f.call("GET", "/v1/me", a.token)).statusCode, 200);
      now += 1001;
      assert.equal((await f.call("GET", "/v1/me", a.token)).statusCode, 401);
      const b = await f.login("B");
      assert.equal(
        (await f.call("POST", "/v1/auth/logout", b.token)).statusCode,
        200
      );
      assert.equal((await f.call("GET", "/v1/me", b.token)).statusCode, 401);
      const disabled = await createFirestoreApp({
        ...f.options,
        seedDemo: false,
        demoMode: false,
      });
      try {
        assert.equal(
          (
            await disabled.inject({
              method: "POST",
              url: "/v1/demo/sessions",
              payload: { account: "A" },
            })
          ).statusCode,
          404
        );
        assert.equal(
          (
            await disabled.inject({
              method: "POST",
              url: "/v1/auth/otp/request",
              payload: { phone: "+84912345678" },
            })
          ).statusCode,
          503
        );
      } finally {
        await disabled.close();
      }
    } finally {
      await f.close();
    }
  }
);
test(
  "Firestore OTP: wrong attempts persist; replay and same-challenge race rejected",
  opts,
  async () => {
    let now = Date.UTC(2026, 10, 1);
    const f = await fixture({ now: () => now });
    try {
      const request = async (phone: string) =>
        (
          await f.call("POST", "/v1/auth/otp/request", undefined, { phone })
        ).json().data;
      const locked = await request("+84911111111");
      for (let i = 0; i < 5; i++)
        assert.equal(
          (
            await f.call("POST", "/v1/auth/otp/verify", undefined, {
              challengeId: locked.challengeId,
              code: "000000",
            })
          ).statusCode,
          400
        );
      assert.equal(
        (
          await f.app.firestore.ref("otpChallenges", locked.challengeId).get()
        ).data()!.attempts,
        5
      );
      assert.equal(
        (
          await f.call("POST", "/v1/auth/otp/verify", undefined, {
            challengeId: locked.challengeId,
            code: locked.demoCode,
          })
        ).statusCode,
        400
      );
      const c = await request("+84922222222"),
        body = { challengeId: c.challengeId, code: c.demoCode };
      const race = await Promise.all([
        f.call("POST", "/v1/auth/otp/verify", undefined, body),
        f.call("POST", "/v1/auth/otp/verify", undefined, body),
      ]);
      assert.deepEqual(race.map((r) => r.statusCode).sort(), [200, 400]);
      assert.equal(
        (await f.call("POST", "/v1/auth/otp/verify", undefined, body))
          .statusCode,
        400
      );
      const users = await f.app.firestore
        .collection("users")
        .where("phone", "==", "+84922222222")
        .get();
      assert.equal(users.size, 1);
      const expired = await request("+84922222223");
      now += 300_001;
      assert.equal(
        (
          await f.call("POST", "/v1/auth/otp/verify", undefined, {
            challengeId: expired.challengeId,
            code: expired.demoCode,
          })
        ).statusCode,
        400
      );
    } finally {
      await f.close();
    }
  }
);
test(
  "Firestore OTP: phone-index uniqueness across challenges and per-phone request rate",
  opts,
  async () => {
    const f = await fixture();
    try {
      const request = async (phone: string) =>
        f.call("POST", "/v1/auth/otp/request", undefined, { phone });
      const challenges = await Promise.all([
        request("+84933333333"),
        request("+84933333333"),
      ]);
      const verified = await Promise.all(
        challenges.map((c) => {
          const b = c.json().data;
          return f.call("POST", "/v1/auth/otp/verify", undefined, {
            challengeId: b.challengeId,
            code: b.demoCode,
          });
        })
      );
      assert.ok(verified.every((r) => r.statusCode === 200));
      assert.equal(
        verified[0].json().data.user.id,
        verified[1].json().data.user.id
      );
      const other = (await request("+84944444444")).json().data;
      const otherUser = (
        await f.call("POST", "/v1/auth/otp/verify", undefined, {
          challengeId: other.challengeId,
          code: other.demoCode,
        })
      ).json().data.user.id;
      assert.notEqual(otherUser, verified[0].json().data.user.id);
      const rates = await Promise.all(
        Array.from({ length: 7 }, () => request("+84955555555"))
      );
      assert.equal(rates.filter((r) => r.statusCode === 200).length, 5);
      assert.equal(rates.filter((r) => r.statusCode === 429).length, 2);
    } finally {
      await f.close();
    }
  }
);
test(
  "Firestore profiles: private DOB/location, enums/null/unknown rejection and transaction preferences",
  opts,
  async () => {
    const f = await fixture();
    try {
      const a = await f.login("A"),
        b = await f.login("B");
      assert.equal(
        (
          await f.call("PATCH", "/v1/me/profile", a.token, {
            displayName: "Tên mới",
            advanced: { education: null, heightCm: 175 },
          })
        ).statusCode,
        200
      );
      const own = (await f.call("GET", "/v1/me/profile", a.token)).json().data,
        publicP = (
          await f.call("GET", `/v1/profiles/${demoIds.A}`, b.token)
        ).json().data;
      assert.equal(own.dateOfBirth, "2000-05-15");
      assert.equal(publicP.dateOfBirth, undefined);
      assert.equal(publicP.displayName, "Tên mới");
      for (const body of [
        { userId: demoIds.B },
        { gender: "invalid" },
        { displayName: null },
        { lifestyle: { smoking: "invalid" } },
      ])
        assert.equal(
          (await f.call("PATCH", "/v1/me/profile", a.token, body)).statusCode,
          400
        );
      assert.equal(
        (
          await f.call("PATCH", "/v1/me/profile", a.token, {
            dateOfBirth: "2020-01-01",
          })
        ).statusCode,
        422
      );
      assert.equal(
        (
          await f.call("PATCH", "/v1/me/profile", a.token, {
            dateOfBirth: "2000-02-30",
          })
        ).statusCode,
        422
      );
      assert.equal(
        (
          await f.call("PATCH", "/v1/me/preferences", a.token, {
            minAge: 40,
            maxAge: 20,
          })
        ).statusCode,
        422
      );
      assert.equal(
        (
          await f.call("PUT", "/v1/me/location", a.token, {
            latitude: 10.7,
            longitude: 106.6,
            consent: false,
          })
        ).statusCode,
        400
      );
      assert.equal(
        (
          await f.call("PUT", "/v1/me/location", a.token, {
            latitude: 10.7,
            longitude: 106.6,
            consent: true,
          })
        ).statusCode,
        200
      );
      assert.equal(
        JSON.stringify(
          (await f.call("GET", `/v1/profiles/${demoIds.A}`, b.token)).json()
        ).includes("latitude"),
        false
      );
      await f.call("DELETE", "/v1/me/location", a.token);
      assert.equal(
        (await f.app.firestore.ref("locations", demoIds.A).get()).exists,
        false
      );
    } finally {
      await f.close();
    }
  }
);
test(
  "Firestore media: authenticated read, ownership, MIME, private selfie and race-safe nine quota",
  opts,
  async () => {
    const f = await fixture();
    try {
      const a = await f.login("A"),
        b = await f.login("B"),
        bytes = await readFile(join(f.dir, "media", "seed-A.png"));
      const seeded = "10000000-0000-4000-8000-000000000001";
      assert.equal(
        (await f.call("GET", `/v1/media/${seeded}/content`)).statusCode,
        401
      );
      assert.equal(
        (await f.call("GET", `/v1/media/${seeded}/content`, a.token))
          .statusCode,
        200
      );
      assert.equal(
        (await f.call("DELETE", `/v1/me/media/${seeded}`, b.token)).statusCode,
        404
      );
      assert.equal(
        (await upload(f, a.token, bytes, "/v1/me/media", "image/jpeg"))
          .statusCode,
        422
      );
      assert.equal(
        (await upload(f, a.token, Buffer.from("not an image"))).statusCode,
        422
      );
      assert.equal(
        (
          await upload(
            f,
            a.token,
            Buffer.concat([bytes, Buffer.alloc(10 * 1024 * 1024)])
          )
        ).statusCode,
        413
      );
      for (let i = 0; i < 7; i++)
        assert.equal((await upload(f, a.token, bytes)).statusCode, 200);
      const concurrent = await Promise.all([
        upload(f, a.token, bytes),
        upload(f, a.token, bytes),
      ]);
      assert.deepEqual(concurrent.map((r) => r.statusCode).sort(), [200, 422]);
      assert.equal(
        (await f.call("GET", "/v1/me/profile", a.token)).json().data.media
          .length,
        9
      );
      assert.equal(
        (await readdir(join(f.dir, "media"))).filter((n) => n.endsWith(".bin"))
          .length,
        8
      );
      const selfie = await upload(
        f,
        a.token,
        bytes,
        "/v1/me/verification/selfie"
      );
      assert.equal(selfie.statusCode, 200);
      assert.equal(selfie.json().data.status, "pending");
      const privateDoc = (
        await f.app.firestore.collection("verificationRequests").get()
      ).docs[0];
      assert.equal(
        (await f.call("GET", `/v1/media/${privateDoc.id}/content`, b.token))
          .statusCode,
        404
      );
      const media = (await f.call("GET", "/v1/me/profile", a.token)).json().data
          .media,
        ids = media.map((m: any) => m.id).reverse();
      assert.equal(
        (
          await f.call("PATCH", "/v1/me/media/order", a.token, {
            mediaIds: ids,
          })
        ).statusCode,
        200
      );
      assert.equal(
        (
          await f.call("PATCH", "/v1/me/media/order", b.token, {
            mediaIds: ids,
          })
        ).statusCode,
        422
      );
      assert.equal(
        (await f.call("DELETE", `/v1/me/media/${ids[0]}`, a.token)).statusCode,
        200
      );
      assert.equal(
        (await f.app.firestore.ref("profiles", demoIds.A).get()).data()!
          .mediaIds.length,
        8
      );
      assert.equal(
        (await f.call("GET", `/v1/media/${seeded}/content`, b.token))
          .statusCode,
        200
      );
      assert.equal(
        (
          await f.call("POST", "/v1/blocks", b.token, {
            targetUserId: demoIds.A,
          })
        ).statusCode,
        200
      );
      assert.equal(
        (await f.call("GET", `/v1/media/${seeded}/content`, b.token))
          .statusCode,
        404
      );
    } finally {
      await f.close();
    }
  }
);
test(
  "Firestore seed and restart: preserve profile edits and media deletion; persisted session remains valid",
  opts,
  async () => {
    const f = await fixture();
    let restarted: Awaited<ReturnType<typeof createFirestoreApp>> | undefined;
    try {
      const a = await f.login("A");
      await f.call("PATCH", "/v1/me/profile", a.token, {
        bio: "Persisted edited bio",
      });
      await f.call(
        "DELETE",
        "/v1/me/media/10000000-0000-4000-8000-000000000001",
        a.token
      );
      await seedFirestoreDemo(f.app.firestore);
      assert.equal(
        (await f.app.firestore.ref("profiles", demoIds.A).get()).data()!.bio,
        "Persisted edited bio"
      );
      assert.equal(
        (
          await f.app.firestore
            .ref("media", "10000000-0000-4000-8000-000000000001")
            .get()
        ).exists,
        false
      );
      await f.app.close();
      restarted = await createFirestoreApp(f.options);
      const response = await restarted.inject({
        method: "GET",
        url: "/v1/me/profile",
        headers: { authorization: `Bearer ${a.token}` },
      });
      assert.equal(response.statusCode, 200);
      assert.equal(response.json().data.bio, "Persisted edited bio");
      assert.equal(response.json().data.media.length, 0);
    } finally {
      if (restarted) {
        await restarted.firestore.db.recursiveDelete(restarted.firestore.root);
        await restarted.close();
        await rm(f.dir, { recursive: true, force: true });
      } else await f.close();
    }
  }
);
