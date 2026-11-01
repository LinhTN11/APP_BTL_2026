import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { io, type Socket } from "socket.io-client";
import { createApp } from "../src/app.js";
import { demoIds } from "../src/db/database.js";

async function fixture(options: Parameters<typeof createApp>[0] = {}) {
  const dir = await mkdtemp(join(tmpdir(), "gap-api-"));
  const app = await createApp({
    dataDir: dir,
    dbPath: join(dir, "test.sqlite"),
    ...options,
  });
  const call = async (
    method: any,
    url: string,
    token?: string,
    payload?: any
  ) =>
    app.inject({
      method,
      url,
      headers: token ? { authorization: `Bearer ${token}` } : {},
      ...(payload !== undefined ? { payload } : {}),
    });
  const login = async (account: string) =>
    (await call("POST", "/v1/demo/sessions", undefined, { account })).json()
      .data;
  return {
    app,
    dir,
    call,
    login,
    close: async () => {
      await app.close();
      await rm(dir, { recursive: true, force: true });
    },
  };
}
async function matched(
  f: Awaited<ReturnType<typeof fixture>>,
  a: string,
  b: string
) {
  await f.call("POST", "/v1/swipes", a, {
    targetUserId: demoIds.B,
    action: "like",
  });
  return (
    await f.call("POST", "/v1/swipes", b, {
      targetUserId: demoIds.A,
      action: "like",
    })
  ).json().data.match.id as string;
}
function multipart(bytes: Buffer, mime = "image/png") {
  const boundary = "gap-boundary";
  return {
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload: Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="avatar.png"\r\nContent-Type: ${mime}\r\n\r\n`
      ),
      bytes,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  };
}
async function connect(url: string, token: string) {
  const socket = io(url, {
    auth: { token },
    transports: ["websocket"],
    reconnection: false,
  });
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
    setTimeout(() => reject(Error("socket connect timeout")), 3000).unref();
  });
  return socket;
}
const ack = (s: Socket, id: string) =>
  new Promise<any>((resolve) =>
    s.emit("match:subscribe", { matchId: id }, resolve)
  );
const event = (s: Socket, name: string) =>
  new Promise<any>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Error(`event timeout ${name}`)),
      3000
    );
    s.once(name, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });

test("schema, auth, private profile, OTP one-time/attempt/expiry and live isolation", async () => {
  let now = Date.now();
  const f = await fixture({ now: () => now });
  try {
    assert.equal((await f.call("GET", "/health")).statusCode, 200);
    assert.equal((await f.call("GET", "/v1/me")).statusCode, 401);
    const a = await f.login("A");
    const pub = (
      await f.call("GET", `/v1/profiles/${demoIds.B}`, a.token)
    ).json().data;
    assert.equal(pub.dateOfBirth, undefined);
    assert.equal(pub.phone, undefined);
    assert.equal(pub.latitude, undefined);
    assert.equal(
      (await f.call("PATCH", "/v1/me/profile", a.token, { userId: demoIds.B }))
        .statusCode,
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
          dateOfBirth: "2000-02-31",
        })
      ).statusCode,
      422
    );
    const otp = (
      await f.call("POST", "/v1/auth/otp/request", undefined, {
        phone: "+84901234567",
      })
    ).json().data;
    assert.equal(otp.mode, "demo");
    assert.equal(
      (
        await f.call("POST", "/v1/auth/otp/verify", undefined, {
          challengeId: otp.challengeId,
          code: otp.demoCode,
        })
      ).statusCode,
      200
    );
    assert.equal(
      (
        await f.call("POST", "/v1/auth/otp/verify", undefined, {
          challengeId: otp.challengeId,
          code: otp.demoCode,
        })
      ).statusCode,
      400
    );
    const bad = (
      await f.call("POST", "/v1/auth/otp/request", undefined, {
        phone: "+84901234568",
      })
    ).json().data;
    for (let i = 0; i < 5; i++)
      assert.equal(
        (
          await f.call("POST", "/v1/auth/otp/verify", undefined, {
            challengeId: bad.challengeId,
            code: "000000",
          })
        ).statusCode,
        400
      );
    assert.equal(
      (
        await f.call("POST", "/v1/auth/otp/verify", undefined, {
          challengeId: bad.challengeId,
          code: bad.demoCode,
        })
      ).statusCode,
      400
    );
    const exp = (
      await f.call("POST", "/v1/auth/otp/request", undefined, {
        phone: "+84901234569",
      })
    ).json().data;
    now += 300001;
    assert.equal(
      (
        await f.call("POST", "/v1/auth/otp/verify", undefined, {
          challengeId: exp.challengeId,
          code: exp.demoCode,
        })
      ).statusCode,
      400
    );
    for (let i = 0; i < 5; i++)
      await f.call("POST", "/v1/auth/otp/request", undefined, {
        phone: "+84901234560",
      });
    const rate = await f.call("POST", "/v1/auth/otp/request", undefined, {
      phone: "+84901234560",
    });
    assert.equal(rate.statusCode, 429);
    assert.ok(rate.headers["retry-after"]);
    await f.call("POST", "/v1/auth/logout", a.token);
    assert.equal((await f.call("GET", "/v1/me", a.token)).statusCode, 401);
  } finally {
    await f.close();
  }
  const live = await fixture({ demoMode: false });
  try {
    assert.equal(
      (
        await live.call("POST", "/v1/demo/sessions", undefined, {
          account: "A",
        })
      ).statusCode,
      404
    );
    assert.equal(
      (
        await live.call("POST", "/v1/auth/otp/request", undefined, {
          phone: "+84901234567",
        })
      ).statusCode,
      503
    );
  } finally {
    await live.close();
  }
});

test("atomic mutual likes, stable retries, discovery filters, private media, block and unmatch lifecycle", async () => {
  const f = await fixture();
  try {
    const a = await f.login("A"),
      b = await f.login("B"),
      c = await f.login("C");
    assert.equal(
      (
        await f.call("POST", "/v1/swipes", a.token, {
          targetUserId: demoIds.A,
          action: "like",
        })
      ).statusCode,
      422
    );
    await f.call("PATCH", "/v1/me/preferences", a.token, {
      genders: ["male"],
      minAge: 18,
      maxAge: 40,
    });
    const discovery = await f.call("GET", "/v1/discovery?limit=1", a.token);
    assert.equal(discovery.json().data.length, 1);
    assert.equal(discovery.json().meta.radiusAvailable, false);
    assert.ok(discovery.json().meta.nextCursor);
    assert.equal(
      (
        await f.call("PUT", "/v1/me/location", a.token, {
          latitude: 200,
          longitude: 0,
          consent: true,
        })
      ).statusCode,
      400
    );
    await f.call("PUT", "/v1/me/location", a.token, {
      latitude: 10,
      longitude: 106,
      consent: true,
    });
    await f.call("PUT", "/v1/me/location", b.token, {
      latitude: 50,
      longitude: 106,
      consent: true,
    });
    assert.ok(
      !(await f.call("GET", "/v1/discovery", a.token))
        .json()
        .data.some((p: any) => p.userId === demoIds.B)
    );
    await f.call("DELETE", "/v1/me/location", a.token);
    await Promise.all([
      f.call("POST", "/v1/swipes", a.token, {
        targetUserId: demoIds.B,
        action: "like",
      }),
      f.call("POST", "/v1/swipes", b.token, {
        targetUserId: demoIds.A,
        action: "like",
      }),
    ]);
    const match = (await f.call("GET", "/v1/matches", a.token)).json().data[0];
    assert.equal(
      (f.app.db.prepare("SELECT count(*) AS n FROM matches").get() as any).n,
      1
    );
    const retried = await f.call("POST", "/v1/swipes", b.token, {
      targetUserId: demoIds.A,
      action: "like",
    });
    assert.equal(retried.json().data.match.id, match.id);
    assert.equal(
      (await f.call("GET", `/v1/matches/${match.id}/messages`, c.token))
        .statusCode,
      404
    );
    const message = {
      clientMessageId: randomUUID(),
      kind: "text",
      text: "Xin chào",
    };
    const sent = await f.call(
      "POST",
      `/v1/matches/${match.id}/messages`,
      a.token,
      message
    );
    assert.equal(sent.statusCode, 200);
    const retry = await f.call(
      "POST",
      `/v1/matches/${match.id}/messages`,
      a.token,
      message
    );
    assert.equal(retry.json().data.id, sent.json().data.id);
    assert.equal(
      (
        await f.call("POST", `/v1/matches/${match.id}/messages`, a.token, {
          ...message,
          text: "khác",
        })
      ).statusCode,
      409
    );
    assert.equal(
      (
        await f.call("POST", `/v1/matches/${match.id}/messages`, a.token, {
          clientMessageId: randomUUID(),
          kind: "gif",
          payload: { url: "https://example.com" },
        })
      ).statusCode,
      400
    );
    assert.equal(
      (
        await f.call("POST", `/v1/matches/${match.id}/messages`, a.token, {
          clientMessageId: randomUUID(),
          kind: "location",
          payload: { latitude: 10, longitude: 106 },
        })
      ).statusCode,
      200
    );
    const firstPage = (
      await f.call("GET", `/v1/matches/${match.id}/messages?limit=1`, b.token)
    ).json();
    assert.equal(firstPage.data.length, 1);
    assert.ok(firstPage.meta.nextCursor);
    const secondPage = (
      await f.call(
        "GET",
        `/v1/matches/${match.id}/messages?limit=1&cursor=${firstPage.meta.nextCursor}`,
        b.token
      )
    ).json();
    assert.equal(secondPage.data.length, 1);
    assert.notEqual(firstPage.data[0].id, secondPage.data[0].id);
    assert.ok(firstPage.data[0].createdAt < secondPage.data[0].createdAt);
    assert.equal(
      (
        await f.call(
          "DELETE",
          "/v1/me/media/10000000-0000-4000-8000-000000000001",
          c.token
        )
      ).statusCode,
      404
    );
    assert.equal(
      (
        await f.call(
          "GET",
          "/v1/media/10000000-0000-4000-8000-000000000001/content"
        )
      ).statusCode,
      401
    );
    const report = await f.call("POST", "/v1/reports", c.token, {
      targetUserId: demoIds.A,
      reasonCode: "spam",
      matchId: match.id,
    });
    assert.equal(report.statusCode, 404);
    await f.call("POST", "/v1/blocks", a.token, { targetUserId: demoIds.B });
    assert.equal(
      (await f.call("GET", `/v1/matches/${match.id}/messages`, b.token))
        .statusCode,
      403
    );
    assert.equal(
      (
        await f.call(
          "GET",
          "/v1/media/10000000-0000-4000-8000-000000000001/content",
          b.token
        )
      ).statusCode,
      404
    );
    await f.call("DELETE", `/v1/blocks/${demoIds.B}`, a.token);
    assert.equal(
      (
        await f.call("POST", "/v1/swipes", a.token, {
          targetUserId: demoIds.B,
          action: "like",
        })
      ).statusCode,
      409
    );
  } finally {
    await f.close();
  }
});

test("multipart signatures, quota race, order ownership, selfie demo and failure cleanup", async () => {
  const f = await fixture();
  try {
    const a = await f.login("A"),
      c = await f.login("C");
    const png = await readFile(join(f.dir, "media", "seed-A.png"));
    const upload = async (bytes = png, mime = "image/png") => {
      const part = multipart(bytes, mime);
      return f.app.inject({
        method: "POST",
        url: "/v1/me/media",
        headers: { ...part.headers, authorization: `Bearer ${a.token}` },
        payload: part.payload,
      });
    };
    assert.equal(
      (await upload(Buffer.from("fake"), "image/png")).statusCode,
      422
    );
    assert.equal(
      (await upload(Buffer.alloc(10 * 1024 * 1024 + 1), "image/png"))
        .statusCode,
      413
    );
    for (let i = 0; i < 7; i++) assert.equal((await upload()).statusCode, 200);
    const concurrent = await Promise.all([upload(), upload()]);
    assert.deepEqual(concurrent.map((r) => r.statusCode).sort(), [200, 422]);
    assert.equal(
      (await f.call("GET", "/v1/me/profile", a.token)).json().data.media.length,
      9
    );
    assert.equal((await readdir(join(f.dir, "media"))).length, 12); // 4 seed + 8 successful uploads, no failed orphan
    const own = (await f.call("GET", "/v1/me/profile", a.token))
      .json()
      .data.media.map((m: any) => m.id);
    assert.equal(
      (await f.call("PATCH", "/v1/me/media/order", c.token, { mediaIds: own }))
        .statusCode,
      422
    );
    assert.equal(
      (
        await f.call("PATCH", "/v1/me/media/order", a.token, {
          mediaIds: own.reverse(),
        })
      ).statusCode,
      200
    );
    const part = multipart(png);
    const selfie = await f.app.inject({
      method: "POST",
      url: "/v1/me/verification/selfie",
      headers: { ...part.headers, authorization: `Bearer ${a.token}` },
      payload: part.payload,
    });
    assert.equal(selfie.json().data.status, "pending");
    assert.equal(selfie.json().data.mode, "demo");
    const file = (await readdir(join(f.dir, "media"))).find((n) =>
      n.startsWith("selfie-")
    );
    assert.equal(
      (await f.call("GET", `/v1/media/${file}/content`, c.token)).statusCode,
      404
    );
  } finally {
    await f.close();
  }
});

test("real socket outsider denied, committed delivery, block/unmatch room revocation and logout", async () => {
  const f = await fixture();
  const sockets: Socket[] = [];
  try {
    await f.app.listen({ host: "127.0.0.1", port: 0 });
    const address = f.app.server.address() as any;
    const url = `http://127.0.0.1:${address.port}`;
    const a = await f.login("A"),
      b = await f.login("B"),
      c = await f.login("C");
    const id = await matched(f, a.token, b.token);
    const sa = await connect(url, a.token),
      sb = await connect(url, b.token),
      sc = await connect(url, c.token);
    sockets.push(sa, sb, sc);
    assert.equal((await ack(sc, id)).ok, false);
    assert.equal((await ack(sa, id)).ok, true);
    assert.equal((await ack(sb, id)).ok, true);
    const received = event(sb, "message:created");
    const sent = await f.call("POST", `/v1/matches/${id}/messages`, a.token, {
      clientMessageId: randomUUID(),
      kind: "text",
      text: "Realtime",
    });
    assert.equal((await received).id, sent.json().data.id);
    const ended = event(sb, "match:ended");
    await f.call("POST", "/v1/blocks", a.token, { targetUserId: demoIds.B });
    assert.equal((await ended).reason, "blocked");
    assert.equal((await ack(sb, id)).ok, false);
    assert.equal(
      (
        await f.call("POST", `/v1/matches/${id}/messages`, b.token, {
          clientMessageId: randomUUID(),
          kind: "text",
          text: "late",
        })
      ).statusCode,
      403
    );
    assert.equal(f.app.io.sockets.adapter.rooms.has(`match:${id}`), false);
    const dc = event(sa, "disconnect");
    await f.call("POST", "/v1/auth/logout", a.token);
    await dc;
    // Separate C/D pair proves unmatch revocation as distinct operation.
    const dd = await f.login("D");
    await f.call("POST", "/v1/swipes", c.token, {
      targetUserId: demoIds.D,
      action: "like",
    });
    const cd = (
      await f.call("POST", "/v1/swipes", dd.token, {
        targetUserId: demoIds.C,
        action: "like",
      })
    ).json().data.match.id;
    await ack(sc, cd);
    const ue = event(sc, "match:ended");
    const res = await f.call("DELETE", `/v1/matches/${cd}`, dd.token);
    assert.equal(res.statusCode, 200);
    assert.equal((await ue).reason, "unmatched");
    assert.equal((await ack(sc, cd)).ok, false);
  } finally {
    sockets.forEach((s) => s.close());
    await f.close();
  }
});

test("session expiry disconnects an already open socket and REST rejects it", async () => {
  const f = await fixture({ sessionTtlMs: 350 });
  let socket: Socket | undefined;
  try {
    await f.app.listen({ host: "127.0.0.1", port: 0 });
    const a = await f.login("A");
    socket = await connect(
      `http://127.0.0.1:${(f.app.server.address() as any).port}`,
      a.token
    );
    await event(socket, "disconnect");
    assert.equal((await f.call("GET", "/v1/me", a.token)).statusCode, 401);
  } finally {
    socket?.close();
    await f.close();
  }
});

test("database restart preserves profile/session/match/messages and seed is idempotent", async () => {
  const dir = await mkdtemp(join(tmpdir(), "gap-restart-"));
  let app = await createApp({ dataDir: dir });
  const inject = async (
    method: any,
    url: string,
    token?: string,
    payload?: any
  ) =>
    app.inject({
      method,
      url,
      headers: token ? { authorization: `Bearer ${token}` } : {},
      ...(payload !== undefined ? { payload } : {}),
    });
  try {
    const a = (
        await inject("POST", "/v1/demo/sessions", undefined, { account: "A" })
      ).json().data,
      b = (
        await inject("POST", "/v1/demo/sessions", undefined, { account: "B" })
      ).json().data;
    await inject("PATCH", "/v1/me/profile", a.token, { bio: "Persistent bio" });
    await inject("POST", "/v1/swipes", a.token, {
      targetUserId: demoIds.B,
      action: "like",
    });
    const match = (
      await inject("POST", "/v1/swipes", b.token, {
        targetUserId: demoIds.A,
        action: "like",
      })
    ).json().data.match;
    await inject("POST", `/v1/matches/${match.id}/messages`, a.token, {
      clientMessageId: randomUUID(),
      kind: "text",
      text: "persist",
    });
    await app.close();
    app = await createApp({ dataDir: dir });
    assert.equal(
      (await inject("GET", "/v1/me/profile", a.token)).json().data.bio,
      "Persistent bio"
    );
    assert.equal(
      (await inject("GET", `/v1/matches/${match.id}/messages`, b.token)).json()
        .data.length,
      1
    );
    assert.equal(
      (app.db.prepare("SELECT count(*) AS n FROM users").get() as any).n,
      4
    );
    assert.equal(
      (app.db.prepare("SELECT count(*) AS n FROM profile_media").get() as any)
        .n,
      4
    );
    assert.equal(
      (app.db.prepare("PRAGMA foreign_keys").get() as any).foreign_keys,
      1
    );
  } finally {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  }
});
