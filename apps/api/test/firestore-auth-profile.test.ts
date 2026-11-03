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
  "Firestore discovery: newly registered incomplete profiles appear only after bio and photo are saved",
  opts,
  async () => {
    const f = await fixture();
    try {
      const a = await f.login("A"), b = await f.login("B");
      // Reproduce real-account onboarding state without altering any cloud data.
      await Promise.all([
        f.app.firestore.ref("profiles", demoIds.C).update({ visibility: "hidden" }),
        f.app.firestore.ref("profiles", demoIds.D).update({ visibility: "hidden" }),
        f.call("PATCH", "/v1/me/profile", a.token, { bio: "" }),
        f.call("PATCH", "/v1/me/profile", b.token, { bio: "   " }),
      ]);
      const bytes = await readFile(join(f.dir, "media", "seed-A.png"));
      assert.equal((await f.call("DELETE", "/v1/me/media/10000000-0000-4000-8000-000000000001", a.token)).statusCode, 200);
      const discover = async (token: string) => {
        const response = await f.call("GET", "/v1/discovery", token);
        assert.equal(response.statusCode, 200, response.body);
        return response.json();
      };
      const initialFromA = await discover(a.token);
      assert.deepEqual(initialFromA.data, []);
      assert.equal(initialFromA.meta.ownProfileComplete, false);
      assert.deepEqual(initialFromA.meta.missingRequirements, ["bio", "media"]);
      assert.equal(
        initialFromA.meta.emptyReason,
        "Chưa có hồ sơ công khai nào khác hoàn thiện đủ thông tin (tên, ngày sinh 18+, giới thiệu và ít nhất 1 ảnh)."
      );
      const initialFromB = await discover(b.token);
      assert.deepEqual(initialFromB.data, []);
      assert.equal(
        initialFromB.meta.emptyReason,
        "Chưa có hồ sơ công khai nào khác hoàn thiện đủ thông tin (tên, ngày sinh 18+, giới thiệu và ít nhất 1 ảnh)."
      );
      const swipeIncomplete = await f.call("POST", "/v1/swipes", a.token, {
        targetUserId: demoIds.B,
        action: "like",
      });
      assert.equal(swipeIncomplete.statusCode, 422, swipeIncomplete.body);
      assert.equal(swipeIncomplete.json().error.code, "PROFILE_INCOMPLETE");
      assert.ok(
        swipeIncomplete.json().error.message.includes("Hồ sơ của bạn chưa đầy đủ")
      );
      assert.equal((await f.call("PATCH", "/v1/me/profile", b.token, { bio: "Đã hoàn thiện giới thiệu" })).statusCode, 200);
      const fromAWithB = await discover(a.token);
      assert.deepEqual(fromAWithB.data.map((p: any) => p.userId), [demoIds.B]);
      assert.equal(fromAWithB.meta.emptyReason, undefined);
      assert.equal((await f.call("PATCH", "/v1/me/profile", a.token, { bio: "Đã có giới thiệu, còn thiếu ảnh" })).statusCode, 200);
      const fromBNoA = await discover(b.token);
      assert.deepEqual(fromBNoA.data, []);
      assert.equal(
        fromBNoA.meta.emptyReason,
        "Chưa có hồ sơ công khai nào khác hoàn thiện đủ thông tin (tên, ngày sinh 18+, giới thiệu và ít nhất 1 ảnh)."
      );
      assert.equal((await upload(f, a.token, bytes)).statusCode, 200);
      // GPS remains optional: consenting on only one side must not hide either profile.
      assert.equal((await f.call("PUT", "/v1/me/location", a.token, {
        latitude: 10.7, longitude: 106.6, consent: true,
      })).statusCode, 200);
      const fromB = await discover(b.token);
      assert.deepEqual(fromB.data.map((p: any) => p.userId), [demoIds.A]);
      assert.equal(fromB.meta.radiusAvailable, false);
      for (const profile of fromB.data) {
        assert.equal(profile.dateOfBirth, undefined);
        assert.equal(profile.latitude, undefined);
        assert.equal(profile.longitude, undefined);
        assert.equal(profile.location, undefined);
      }
      assert.equal((await discover(a.token)).meta.radiusAvailable, true);
      await f.app.firestore.ref("profiles", demoIds.A).update({ dateOfBirth: null });
      assert.deepEqual((await discover(b.token)).data, []);
      const aMissingDob = await discover(a.token);
      assert.equal(aMissingDob.meta.ownProfileComplete, false);
      assert.deepEqual(aMissingDob.meta.missingRequirements, ["dateOfBirth"]);
      await f.app.firestore.ref("profiles", demoIds.A).update({ dateOfBirth: "1999-04-12" });
      const aComplete = await discover(a.token);
      assert.equal(aComplete.meta.ownProfileComplete, true);
      assert.deepEqual(aComplete.meta.missingRequirements, []);
      await f.app.firestore.ref("profiles", demoIds.B).update({ visibility: "hidden" });
      const swipeUnavailable = await f.call("POST", "/v1/swipes", a.token, {
        targetUserId: demoIds.B,
        action: "like",
      });
      assert.equal(swipeUnavailable.statusCode, 422, swipeUnavailable.body);
      assert.equal(swipeUnavailable.json().error.code, "PROFILE_UNAVAILABLE");
      await f.app.firestore.ref("profiles", demoIds.B).update({ visibility: "public" });
      await f.app.firestore.ref("profiles", demoIds.A).update({ dateOfBirth: "2020-01-01" });
      assert.deepEqual((await discover(b.token)).data, []);
      await f.app.firestore.ref("profiles", demoIds.A).update({ dateOfBirth: "2000-05-15" });
      assert.equal((await f.call("POST", "/v1/blocks", b.token, { targetUserId: demoIds.A })).statusCode, 200);
      const afterBlockB = await discover(b.token);
      assert.deepEqual(afterBlockB.data, []);
      assert.equal(
        afterBlockB.meta.emptyReason,
        "Bạn đã xem hoặc tương tác hết các hồ sơ đủ điều kiện hiện có; các tài khoản còn lại chưa hoàn thiện hồ sơ (thiếu giới thiệu hoặc ảnh)."
      );
      const afterBlockA = await discover(a.token);
      assert.deepEqual(afterBlockA.data, []);
      assert.equal(
        afterBlockA.meta.emptyReason,
        "Bạn đã xem hoặc tương tác hết các hồ sơ đủ điều kiện hiện có; các tài khoản còn lại chưa hoàn thiện hồ sơ (thiếu giới thiệu hoặc ảnh)."
      );
    } finally {
      await f.close();
    }
  }
);

test(
  "Firestore own location status: authenticated actor only, consent lifecycle and private response",
  opts,
  async () => {
    let now = Date.UTC(2026, 10, 2, 3);
    const f = await fixture({ now: () => now });
    try {
      const a = await f.login("A"), b = await f.login("B");
      const status = async (token: string) => {
        const response = await f.call("GET", "/v1/me/location", token);
        assert.equal(response.statusCode, 200, response.body);
        return response.json();
      };
      const absent = { data: { hasLocation: false, updatedAt: null } };
      assert.deepEqual(await status(a.token), absent);
      assert.equal((await f.call("GET", "/v1/me/location")).statusCode, 401);
      assert.equal((await f.call("GET", "/v1/me/location", "invalid-session")).statusCode, 401);
      const savedAt = new Date(now).toISOString();
      const put = await f.call("PUT", "/v1/me/location", a.token, {
        latitude: 10, longitude: 106, consent: true,
      });
      assert.equal(put.statusCode, 200, put.body);
      assert.equal(put.json().data.updatedAt, savedAt);
      now += 60_000;
      // Read the stored server time, never the clock at the time of GET.
      assert.deepEqual(await status(a.token), {
        data: { hasLocation: true, updatedAt: savedAt },
      });
      assert.deepEqual(await status(b.token), absent);
      for (const query of [`userId=${demoIds.A}`, `targetUserId=${demoIds.A}`])
        assert.equal((await f.call("GET", `/v1/me/location?${query}`, b.token)).statusCode, 400);
      assert.equal((await f.call("GET", `/v1/profiles/${demoIds.A}/location`, b.token)).statusCode, 404);
      await f.app.firestore.ref("locations", demoIds.A).update({ consent: false });
      assert.deepEqual(await status(a.token), absent);
      await f.app.firestore.ref("locations", demoIds.A).set({
        latitude: 10, longitude: 106, consent: true,
      });
      assert.deepEqual(await status(a.token), {
        data: { hasLocation: true, updatedAt: null },
      });
      for (const updatedAt of [
        "invalid-time", "0", "2026-11-02", "2026-02-30T03:00:00.000Z",
      ]) {
        await f.app.firestore.ref("locations", demoIds.A).update({ updatedAt });
        assert.deepEqual(await status(a.token), {
          data: { hasLocation: true, updatedAt: null },
        }, `Malformed legacy timestamp: ${updatedAt}`);
      }
      assert.equal((await f.call("DELETE", "/v1/me/location", a.token)).statusCode, 200);
      assert.deepEqual(await status(a.token), absent);
      assert.equal((await f.app.firestore.ref("locations", demoIds.A).get()).exists, false);
      assert.equal((await f.call("POST", "/v1/auth/logout", a.token)).statusCode, 200);
      assert.equal((await f.call("GET", "/v1/me/location", a.token)).statusCode, 401);
    } finally {
      await f.close();
    }
  }
);

test(
  "Firestore discovery radius: far excluded, near reloaded, missing GPS fallback and safety preserved",
  opts,
  async () => {
    const f = await fixture();
    try {
      const a = await f.login("A"), b = await f.login("B");
      await Promise.all(["C", "D"].map(account =>
        f.app.firestore.ref("profiles", demoIds[account]).update({ visibility: "hidden" })
      ));
      const locate = async (token: string, latitude: number, longitude: number) => {
        const response = await f.call("PUT", "/v1/me/location", token, {
          latitude, longitude, consent: true,
        });
        assert.equal(response.statusCode, 200, response.body);
      };
      const discover = async (token: string) => {
        const response = await f.call("GET", "/v1/discovery", token);
        assert.equal(response.statusCode, 200, response.body);
        const body = response.json();
        for (const profile of body.data)
          for (const key of ["latitude", "longitude", "location", "dateOfBirth"])
            assert.equal(profile[key], undefined);
        return body;
      };
      const ids = async (token: string) => (await discover(token)).data.map((p: any) => p.userId);
      assert.equal((await f.call("PATCH", "/v1/me/preferences", a.token, { radiusKm: 1000 })).statusCode, 200);
      assert.equal((await f.call("PATCH", "/v1/me/preferences", b.token, { radiusKm: 100 })).statusCode, 200);
      // These emulator-only coordinates exceed both radii; never repair by widening policy.
      await locate(a.token, 10, 106);
      await locate(b.token, 40, -74);
      const farFromA = await discover(a.token);
      assert.deepEqual(farFromA.data, []);
      assert.equal(
        farFromA.meta.emptyReason,
        "Không có hồ sơ khớp với bộ lọc hoặc bán kính hiện tại. Bạn có thể mở Bộ lọc cơ bản hoặc cập nhật vị trí GPS rồi thử lại."
      );
      const farFromB = await discover(b.token);
      assert.deepEqual(farFromB.data, []);
      assert.equal(
        farFromB.meta.emptyReason,
        "Không có hồ sơ khớp với bộ lọc hoặc bán kính hiện tại. Bạn có thể mở Bộ lọc cơ bản hoặc cập nhật vị trí GPS rồi thử lại."
      );
      assert.equal(farFromA.meta.radiusAvailable, true);
      await locate(b.token, 10.001, 106.001);
      assert.deepEqual(await ids(a.token), [demoIds.B]);
      assert.deepEqual(await ids(b.token), [demoIds.A]);
      // A missing location keeps the existing optional-GPS fallback in both directions.
      assert.equal((await f.call("DELETE", "/v1/me/location", b.token)).statusCode, 200);
      assert.deepEqual(await ids(a.token), [demoIds.B]);
      assert.deepEqual(await ids(b.token), [demoIds.A]);
      assert.equal((await discover(b.token)).meta.radiusAvailable, false);
      await locate(b.token, 10.001, 106.001);
      await f.app.firestore.ref("profiles", demoIds.B).update({ visibility: "hidden" });
      assert.deepEqual(await ids(a.token), []);
      await f.app.firestore.ref("profiles", demoIds.B).update({ visibility: "public", dateOfBirth: "2020-01-01" });
      assert.deepEqual(await ids(a.token), []);
      await f.app.firestore.ref("profiles", demoIds.B).update({ dateOfBirth: "2000-05-15" });
      for (const [blocker, target] of [[a, demoIds.B], [b, demoIds.A]] as const) {
        assert.equal((await f.call("POST", "/v1/blocks", blocker.token, { targetUserId: target })).statusCode, 200);
        await locate(b.token, 10.002, 106.002);
        assert.deepEqual(await ids(a.token), []);
        assert.deepEqual(await ids(b.token), []);
        assert.equal((await f.call("DELETE", `/v1/blocks/${target}`, blocker.token)).statusCode, 200);
      }
      const swipe = await f.call("POST", "/v1/swipes", a.token, { targetUserId: demoIds.B, action: "like" });
      assert.equal(swipe.statusCode, 200, swipe.body);
      assert.equal(swipe.json().data.match, null);
      await locate(b.token, 10.003, 106.003);
      assert.deepEqual(await ids(a.token), []);
      assert.deepEqual(await ids(b.token), [demoIds.A]);
      const mutual = await f.call("POST", "/v1/swipes", b.token, { targetUserId: demoIds.A, action: "like" });
      assert.equal(mutual.statusCode, 200, mutual.body);
      const matchId = mutual.json().data.match.id;
      await locate(a.token, 10.004, 106.004);
      assert.deepEqual(await ids(a.token), []);
      assert.deepEqual(await ids(b.token), []);
      assert.deepEqual((await f.call("GET", "/v1/matches", a.token)).json().data.map((m: any) => m.id), [matchId]);
      assert.equal((await f.app.firestore.collection("matches").get()).size, 1);
    } finally {
      await f.close();
    }
  }
);

test(
  "Firestore discovery and swipes: dangling or invalid media ID marks profile incomplete and excludes candidate",
  opts,
  async () => {
    const f = await fixture();
    try {
      const a = await f.login("A"),
        b = await f.login("B");
      const fakeMediaId = "00000000-0000-4000-8000-999999999999";
      await f.app.firestore.ref("profiles", demoIds.A).update({
        mediaIds: [fakeMediaId],
      });
      const discA = (await f.call("GET", "/v1/discovery", a.token)).json();
      assert.equal(discA.meta.ownProfileComplete, false);
      assert.ok(discA.meta.missingRequirements.includes("media"));
      const swipeFromA = await f.call("POST", "/v1/swipes", a.token, {
        targetUserId: demoIds.B,
        action: "like",
      });
      assert.equal(swipeFromA.statusCode, 422);
      assert.equal(swipeFromA.json().error.code, "PROFILE_INCOMPLETE");
      assert.ok(swipeFromA.json().error.message.includes("ít nhất 1 ảnh hồ sơ"));
      await Promise.all([
        f.app.firestore.ref("profiles", demoIds.C).update({ visibility: "hidden" }),
        f.app.firestore.ref("profiles", demoIds.D).update({ visibility: "hidden" }),
      ]);
      const discB = (await f.call("GET", "/v1/discovery", b.token)).json();
      assert.deepEqual(discB.data, []);
      assert.equal(
        discB.meta.emptyReason,
        "Chưa có hồ sơ công khai nào khác hoàn thiện đủ thông tin (tên, ngày sinh 18+, giới thiệu và ít nhất 1 ảnh)."
      );
      const swipeFromB = await f.call("POST", "/v1/swipes", b.token, {
        targetUserId: demoIds.A,
        action: "like",
      });
      assert.equal(swipeFromB.statusCode, 422);
      assert.equal(swipeFromB.json().error.code, "PROFILE_UNAVAILABLE");
      const validMediaId = "10000000-0000-4000-8000-000000000001";
      await f.app.firestore.ref("profiles", demoIds.A).update({
        mediaIds: [validMediaId],
      });
      await Promise.all([
        f.app.firestore.ref("profiles", demoIds.C).update({ visibility: "public" }),
        f.app.firestore.ref("profiles", demoIds.D).update({ visibility: "public" }),
      ]);
      for (const targetId of [demoIds.A, demoIds.C, demoIds.D]) {
        assert.equal(
          (await f.call("POST", "/v1/swipes", b.token, { targetUserId: targetId, action: "pass" })).statusCode,
          200
        );
      }
      const discBAllSwiped = (await f.call("GET", "/v1/discovery", b.token)).json();
      assert.deepEqual(discBAllSwiped.data, []);
      assert.equal(
        discBAllSwiped.meta.emptyReason,
        "Bạn đã xem hoặc tương tác hết các hồ sơ đủ điều kiện hiện tại (các hồ sơ đã Thích, Bỏ qua, Chặn hoặc đã kết thúc kết nối sẽ không hiện lại)."
      );
      await Promise.all([
        f.app.firestore.ref("swipes", `${demoIds.B}_${demoIds.A}`).delete(),
        f.app.firestore.ref("swipes", `${demoIds.B}_${demoIds.C}`).delete(),
        f.app.firestore.ref("swipes", `${demoIds.B}_${demoIds.D}`).delete(),
      ]);
      await f.call("PATCH", "/v1/me/preferences", b.token, { minAge: 99, maxAge: 100 });
      const discBFilter = (await f.call("GET", "/v1/discovery", b.token)).json();
      assert.deepEqual(discBFilter.data, []);
      assert.equal(
        discBFilter.meta.emptyReason,
        "Không có hồ sơ khớp với bộ lọc hoặc bán kính hiện tại. Bạn có thể mở Bộ lọc cơ bản hoặc cập nhật vị trí GPS rồi thử lại."
      );
    } finally {
      await f.close();
    }
  }
);

test(
  "Firestore profile PATCH preserves omitted lifestyle fields, clears explicit null and serializes concurrent edits",
  opts,
  async () => {
    const f = await fixture();
    try {
      const a = await f.login("A");
      const initial = await f.call("PATCH", "/v1/me/profile", a.token, {
        lifestyle: { smoking: "never", drinking: "sometimes", zodiac: "Leo" },
      });
      assert.equal(initial.statusCode, 200);
      const changed = await f.call("PATCH", "/v1/me/profile", a.token, {
        lifestyle: { smoking: "often" },
      });
      assert.equal(changed.statusCode, 200);
      assert.deepEqual(changed.json().data.lifestyle, {
        smoking: "often",
        drinking: "sometimes",
        zodiac: "Leo",
      });
      const concurrent = await Promise.all([
        f.call("PATCH", "/v1/me/profile", a.token, {
          lifestyle: { smoking: "never" },
        }),
        f.call("PATCH", "/v1/me/profile", a.token, {
          lifestyle: { drinking: "often" },
        }),
      ]);
      assert.ok(concurrent.every((response) => response.statusCode === 200));
      const reloaded = await f.call("GET", "/v1/me/profile", a.token);
      assert.deepEqual(reloaded.json().data.lifestyle, {
        smoking: "never",
        drinking: "often",
        zodiac: "Leo",
      });
      const cleared = await f.call("PATCH", "/v1/me/profile", a.token, {
        lifestyle: { smoking: null, zodiac: null },
      });
      assert.equal(cleared.statusCode, 200);
      assert.deepEqual(cleared.json().data.lifestyle, { drinking: "often" });
      assert.deepEqual(
        (await f.call("GET", "/v1/me/profile", a.token)).json().data.lifestyle,
        { drinking: "often" }
      );
      assert.deepEqual(
        (await f.app.firestore.ref("profiles", demoIds.A).get()).data()!.lifestyle,
        { drinking: "often" }
      );
      const invalid = await f.call("PATCH", "/v1/me/profile", a.token, {
        lifestyle: { drinking: "invalid", smoking: null },
      });
      assert.equal(invalid.statusCode, 400);
      assert.deepEqual(
        (await f.call("GET", "/v1/me/profile", a.token)).json().data.lifestyle,
        { drinking: "often" }
      );
      const clearAndUpdateRace = await Promise.all([
        f.call("PATCH", "/v1/me/profile", a.token, { lifestyle: { drinking: null } }),
        f.call("PATCH", "/v1/me/profile", a.token, { lifestyle: { zodiac: "Gemini" } }),
      ]);
      assert.ok(clearAndUpdateRace.every(response => response.statusCode === 200));
      assert.deepEqual(
        (await f.call("GET", "/v1/me/profile", a.token)).json().data.lifestyle,
        { zodiac: "Gemini" }
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
