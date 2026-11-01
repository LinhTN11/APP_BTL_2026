import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { io, type Socket } from "socket.io-client";
import { createFirestoreApp } from "../src/firestore/app.js";
import { demoIds, seedFirestoreDemo } from "../src/firestore/seed.js";
import { pairDocumentId } from "../src/firestore/matching.js";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
const options = {
  skip: emulatorHost
    ? false
    : "Actual Firestore emulator required: set FIRESTORE_EMULATOR_HOST explicitly",
};
type App = Awaited<ReturnType<typeof createFirestoreApp>>;
async function fixture(extra: Parameters<typeof createFirestoreApp>[0] = {}) {
  const dir = await mkdtemp(join(tmpdir(), "gap-firestore-interaction-"));
  const config = {
    projectId: "demo-app-cuoi-ky",
    emulatorHost,
    namespace: `interaction-${randomUUID().slice(0, 8)}`,
    dataDir: dir,
    demoMode: true,
    seedDemo: true,
    ...extra,
  };
  const app = await createFirestoreApp(config);
  const apps = [app];
  const call = (
    method: any,
    url: string,
    token?: string,
    payload?: any,
    target: App = app
  ) =>
    target.inject({
      method,
      url,
      headers: token ? { authorization: `Bearer ${token}` } : {},
      ...(payload !== undefined ? { payload } : {}),
    });
  const login = async (account: string, target: App = app) =>
    (
      await call("POST", "/v1/demo/sessions", undefined, { account }, target)
    ).json().data;
  return {
    app,
    config,
    call,
    login,
    async second() {
      const second = await createFirestoreApp({ ...config, seedDemo: false });
      apps.push(second);
      return second;
    },
    async close() {
      // Only this newly generated emulator namespace is erased, never shared/cloud data.
      assert.match(config.namespace, /^interaction-[\da-f]{8}$/);
      await app.firestore.db.recursiveDelete(app.firestore.root);
      for (const candidate of apps) await candidate.close();
      assert.ok(dir.startsWith(join(tmpdir(), "gap-firestore-interaction-")));
      await rm(dir, { recursive: true, force: true });
    },
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function match(f: Fixture, a: string, b: string, other: App = f.app) {
  const results = await Promise.all([
    f.call("POST", "/v1/swipes", a, {
      targetUserId: demoIds.B,
      action: "like",
    }),
    f.call(
      "POST",
      "/v1/swipes",
      b,
      { targetUserId: demoIds.A, action: "like" },
      other
    ),
  ]);
  for (const response of results)
    assert.equal(response.statusCode, 200, response.body);
  return pairDocumentId(demoIds.A, demoIds.B);
}
async function connect(app: App, token: string) {
  const address = await app.listen({ port: 0, host: "127.0.0.1" });
  const socket = io(address, {
    auth: { token },
    transports: ["websocket"],
    reconnection: false,
  });
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error("connect timeout")), 5000);
    socket.once("connect", () => {
      clearTimeout(timeout);
      resolve();
    });
    socket.once("connect_error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
  return socket;
}
const subscribe = (socket: Socket, matchId: string, extra = {}) =>
  new Promise<any>((resolve, reject) =>
    socket
      .timeout(5000)
      .emit("match:subscribe", { matchId, ...extra }, (error: any, ack: any) =>
        error ? reject(error) : resolve(ack)
      )
  );
function event(socket: Socket, name: string) {
  return new Promise<any>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(Error(`event timeout ${name}`)),
      5000
    );
    socket.once(name, (value) => {
      clearTimeout(timeout);
      resolve(value);
    });
  });
}
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test(
  "Firestore across instances: canonical mutual-like, durable idempotent messages, cursor and privacy",
  options,
  async () => {
    let now = Date.now();
    const f = await fixture({ now: () => now });
    try {
      const second = await f.second(),
        a = await f.login("A"),
        b = await f.login("B", second),
        c = await f.login("C");
      const discovery = await f.call("GET", "/v1/discovery?limit=1", a.token);
      assert.equal(discovery.statusCode, 200, discovery.body);
      assert.equal(discovery.json().data.length, 1);
      assert.equal(discovery.json().data[0].dateOfBirth, undefined);
      assert.equal(discovery.json().meta.radiusAvailable, false);
      const id = await match(f, a.token, b.token, second);
      const retries = await Promise.all(
        Array.from({ length: 4 }, () =>
          f.call(
            "POST",
            "/v1/swipes",
            a.token,
            { targetUserId: demoIds.B, action: "like" },
            second
          )
        )
      );
      for (const response of retries) {
        assert.equal(response.statusCode, 200, response.body);
        assert.equal(response.json().data.match.id, id);
      }
      assert.equal((await f.app.firestore.collection("matches").get()).size, 1);
      assert.equal(
        (await f.call("GET", "/v1/matches", b.token)).json().data[0].id,
        id
      );
      for (const method of ["GET", "POST"]) {
        const response = await f.call(
          method,
          `/v1/matches/${id}/messages`,
          c.token,
          method === "POST"
            ? { clientMessageId: randomUUID(), kind: "text", text: "denied" }
            : undefined
        );
        assert.equal(response.statusCode, 404, response.body);
        assert.equal(response.json().error.code, "NOT_FOUND");
        assert.ok(response.json().error.requestId);
      }
      const body = {
        clientMessageId: randomUUID(),
        kind: "text",
        text: "literal <script>",
      };
      const sends = await Promise.all(
        Array.from({ length: 6 }, (_, i) =>
          f.call(
            "POST",
            `/v1/matches/${id}/messages`,
            a.token,
            body,
            i % 2 ? second : f.app
          )
        )
      );
      for (const response of sends)
        assert.equal(response.statusCode, 200, response.body);
      assert.equal(
        new Set(sends.map((response) => response.json().data.id)).size,
        1
      );
      assert.equal(
        (await f.app.firestore.collection("messages").get()).size,
        1
      );
      const conflict = await f.call(
        "POST",
        `/v1/matches/${id}/messages`,
        a.token,
        { ...body, text: "different" }
      );
      assert.equal(conflict.statusCode, 409, conflict.body);
      assert.equal(conflict.json().error.code, "MESSAGE_RETRY_CONFLICT");
      const first = (
        await f.call("GET", `/v1/matches/${id}/messages?limit=1`, b.token)
      ).json();
      assert.equal(first.data[0].text, "literal <script>");
      const messages = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          f.call(
            "POST",
            `/v1/matches/${id}/messages`,
            a.token,
            { clientMessageId: randomUUID(), kind: "text", text: `later-${i}` },
            second
          )
        )
      );
      for (const response of messages)
        assert.equal(response.statusCode, 200, response.body);
      const page1 = (
        await f.call("GET", `/v1/matches/${id}/messages?limit=2`, b.token)
      ).json();
      const page2 = (
        await f.call(
          "GET",
          `/v1/matches/${id}/messages?limit=2&cursor=${page1.meta.nextCursor}`,
          b.token
        )
      ).json();
      const page3 = (
        await f.call(
          "GET",
          `/v1/matches/${id}/messages?limit=2&cursor=${page2.meta.nextCursor}`,
          b.token
        )
      ).json();
      const all = [...page1.data, ...page2.data, ...page3.data];
      assert.equal(all.length, 6);
      assert.equal(new Set(all.map((message) => message.id)).size, 6);
      assert.equal(page3.meta.nextCursor, null);
      assert.deepEqual(
        all.map((message) => message.createdAt),
        all.map((message) => message.createdAt).sort()
      );
      assert.equal(
        new Set(all.map((message) => message.createdAt)).size,
        6,
        "timestamps remain forward-page safe with frozen clock"
      );
      assert.equal(
        (
          await f.call(
            "GET",
            `/v1/matches/${id}/messages?cursor=garbage`,
            a.token
          )
        ).statusCode,
        400
      );
      assert.equal(
        (
          await f.call("POST", `/v1/matches/${id}/messages`, a.token, {
            clientMessageId: randomUUID(),
            kind: "location",
            payload: { latitude: 91, longitude: 0 },
          })
        ).statusCode,
        400
      );
      for (const input of [
        { kind: "gif", payload: { catalogId: "coffee" } },
        { kind: "sticker", payload: { catalogId: "heart" } },
        { kind: "location", payload: { latitude: 10.77, longitude: 106.69 } },
      ]) {
        const response = await f.call(
          "POST",
          `/v1/matches/${id}/messages`,
          b.token,
          { clientMessageId: randomUUID(), ...input }
        );
        assert.equal(response.statusCode, 200, response.body);
        assert.deepEqual(response.json().data.payload, input.payload);
      }
      assert.equal(
        (
          await f.call("POST", `/v1/matches/${id}/read`, c.token, {
            messageId: all[0].id,
          })
        ).statusCode,
        404
      );
      assert.equal(
        (
          await f.call("POST", `/v1/matches/${id}/read`, b.token, {
            messageId: all[0].id,
          })
        ).statusCode,
        200
      );
      assert.equal(
        (
          await f.app.firestore.ref("readCursors", `${demoIds.B}_${id}`).get()
        ).data()!.messageId,
        all[0].id
      );
      const report = await f.call("POST", "/v1/reports", a.token, {
        targetUserId: demoIds.B,
        matchId: id,
        reasonCode: "uncomfortable",
        detail: "private",
      });
      assert.equal(report.statusCode, 200, report.body);
      assert.equal(report.json().data.status, "received");
      assert.equal(
        (
          await f.call("POST", "/v1/reports", c.token, {
            targetUserId: demoIds.B,
            matchId: id,
            reasonCode: "false membership",
          })
        ).statusCode,
        404
      );
      const third = await f.second();
      assert.equal(
        (
          await f.call(
            "GET",
            `/v1/matches/${id}/messages`,
            b.token,
            undefined,
            third
          )
        ).json().data.length,
        9,
        "fresh backend reads persisted history"
      );
      await seedFirestoreDemo(third.firestore);
      assert.equal(
        (await third.firestore.collection("messages").get()).size,
        9
      );
    } finally {
      await f.close();
    }
  }
);

test(
  "Firestore sockets: C/injected room denied, commit delivery, block revoke, unblocking never rematches",
  options,
  async () => {
    const f = await fixture();
    let aSocket: Socket | undefined,
      bSocket: Socket | undefined,
      cSocket: Socket | undefined;
    try {
      const a = await f.login("A"),
        b = await f.login("B"),
        c = await f.login("C"),
        id = await match(f, a.token, b.token);
      aSocket = await connect(f.app, a.token);
      const address = `http://127.0.0.1:${
        (f.app.server.address() as any).port
      }`;
      const connectExisting = async (token: string) => {
        const socket = io(address, {
          auth: { token },
          transports: ["websocket"],
          reconnection: false,
        });
        await new Promise<void>((resolve, reject) => {
          socket.once("connect", resolve);
          socket.once("connect_error", reject);
        });
        return socket;
      };
      bSocket = await connectExisting(b.token);
      cSocket = await connectExisting(c.token);
      assert.equal((await subscribe(cSocket, id)).error.code, "NOT_FOUND");
      assert.equal(
        (
          await subscribe(aSocket, id, {
            room: `match:${id}`,
            userId: demoIds.B,
          })
        ).error.code,
        "VALIDATION_ERROR"
      );
      assert.deepEqual(await subscribe(aSocket, id), { ok: true });
      assert.deepEqual(await subscribe(bSocket, id), { ok: true });
      const received = event(bSocket, "message:created"),
        payload = {
          clientMessageId: randomUUID(),
          kind: "text",
          text: "committed",
        };
      const sent = await f.call(
        "POST",
        `/v1/matches/${id}/messages`,
        a.token,
        payload
      );
      assert.equal(sent.statusCode, 200, sent.body);
      assert.equal((await received).id, sent.json().data.id);
      const ended = event(bSocket, "match:ended");
      const blocked = await f.call("POST", "/v1/blocks", a.token, {
        targetUserId: demoIds.B,
      });
      assert.equal(blocked.statusCode, 200, blocked.body);
      assert.deepEqual(await ended, { matchId: id, reason: "blocked" });
      for (const serverSocket of f.app.firestore.io.sockets.sockets.values())
        assert.equal(serverSocket.rooms.has(`match:${id}`), false);
      assert.equal((await subscribe(bSocket, id)).error.code, "MATCH_INACTIVE");
      assert.equal(
        (await f.call("GET", `/v1/matches/${id}/messages`, b.token)).statusCode,
        403
      );
      assert.equal(
        (await f.call("POST", `/v1/matches/${id}/messages`, a.token, payload))
          .statusCode,
        403,
        "even an idempotent retry cannot bypass revocation"
      );
      assert.equal(
        (await f.call("GET", "/v1/matches", b.token)).json().data.length,
        0
      );
      assert.equal(
        (await f.call("GET", "/v1/blocks", a.token)).json().data[0]
          .targetUserId,
        demoIds.B
      );
      assert.equal(
        (await f.call("GET", "/v1/discovery", b.token))
          .json()
          .data.some((profile: any) => profile.userId === demoIds.A),
        false
      );
      await f.call("DELETE", `/v1/blocks/${demoIds.B}`, a.token);
      assert.equal(
        (
          await f.call("POST", "/v1/swipes", b.token, {
            targetUserId: demoIds.A,
            action: "like",
          })
        ).json().error.code,
        "MATCH_ENDED"
      );
      assert.equal(
        (await f.app.firestore.ref("reports", "missing").get()).exists,
        false
      );
    } finally {
      aSocket?.disconnect();
      bSocket?.disconnect();
      cSocket?.disconnect();
      await f.close();
    }
  }
);

test(
  "Firestore competing sends/unmatch across instances and private unmatch reason",
  options,
  async () => {
    const f = await fixture();
    try {
      const second = await f.second(),
        a = await f.login("A"),
        b = await f.login("B"),
        c = await f.login("C"),
        id = await match(f, a.token, b.token);
      assert.equal(
        (await f.call("DELETE", `/v1/matches/${id}`, c.token)).statusCode,
        404
      );
      const responses = await Promise.all([
        ...Array.from({ length: 5 }, () =>
          f.call(
            "POST",
            `/v1/matches/${id}/messages`,
            a.token,
            { clientMessageId: randomUUID(), kind: "text", text: "race" },
            second
          )
        ),
        f.call("DELETE", `/v1/matches/${id}`, b.token, {
          reasonCode: "private reason",
        }),
      ]);
      for (const response of responses.slice(0, 5))
        assert.ok([200, 403].includes(response.statusCode), response.body);
      assert.equal(responses[5].statusCode, 200, responses[5].body);
      assert.equal(
        (await f.app.firestore.collection("messages").get()).size,
        responses.slice(0, 5).filter((response) => response.statusCode === 200)
          .length
      );
      assert.equal(
        (await f.app.firestore.ref("matches", id).get()).data()!.status,
        "ended"
      );
      assert.equal(
        (
          await f.call(
            "POST",
            `/v1/matches/${id}/messages`,
            a.token,
            { clientMessageId: randomUUID(), kind: "text", text: "too late" },
            second
          )
        ).statusCode,
        403
      );
      assert.equal(
        (
          await f.call(
            "DELETE",
            `/v1/matches/${id}`,
            b.token,
            undefined,
            second
          )
        ).statusCode,
        200,
        "unmatch retry is stable"
      );
      assert.equal(
        (await f.app.firestore.collection("unmatchFeedback").get()).size,
        1
      );
      assert.equal(
        (await f.call("GET", "/v1/matches", a.token)).body.includes(
          "private reason"
        ),
        false
      );
      const d = await f.login("D");
      const likes = await Promise.all([
        f.call("POST", "/v1/swipes", a.token, {
          targetUserId: demoIds.D,
          action: "like",
        }),
        f.call(
          "POST",
          "/v1/swipes",
          d.token,
          { targetUserId: demoIds.A, action: "like" },
          second
        ),
      ]);
      for (const response of likes)
        assert.equal(response.statusCode, 200, response.body);
      const otherId = pairDocumentId(demoIds.A, demoIds.D),
        countBefore = (await f.app.firestore.collection("messages").get()).size;
      const blockedRace = await Promise.all([
        ...Array.from({ length: 3 }, () =>
          f.call("POST", `/v1/matches/${otherId}/messages`, a.token, {
            clientMessageId: randomUUID(),
            kind: "text",
            text: "block race",
          })
        ),
        f.call(
          "POST",
          "/v1/blocks",
          d.token,
          { targetUserId: demoIds.A },
          second
        ),
      ]);
      for (const response of blockedRace.slice(0, 3))
        assert.ok([200, 403].includes(response.statusCode), response.body);
      assert.equal(blockedRace[3].statusCode, 200, blockedRace[3].body);
      assert.equal(
        (await f.app.firestore.collection("messages").get()).size,
        countBefore +
          blockedRace
            .slice(0, 3)
            .filter((response) => response.statusCode === 200).length
      );
      assert.equal(
        (
          await f.call("POST", `/v1/matches/${otherId}/messages`, a.token, {
            clientMessageId: randomUUID(),
            kind: "text",
            text: "after blocked",
          })
        ).statusCode,
        403
      );
    } finally {
      await f.close();
    }
  }
);

test(
  "Firestore socket session expiry/logout and cross-instance lifecycle listener remove rooms",
  options,
  async () => {
    let now = Date.now();
    const f = await fixture({ now: () => now, sessionTtlMs: 60_000 });
    let socket: Socket | undefined;
    try {
      const second = await f.second(),
        a = await f.login("A"),
        b = await f.login("B"),
        id = await match(f, a.token, b.token);
      socket = await connect(f.app, a.token);
      assert.deepEqual(await subscribe(socket, id), { ok: true });
      await f.call(
        "POST",
        "/v1/blocks",
        b.token,
        { targetUserId: demoIds.A },
        second
      );
      for (
        let attempt = 0;
        attempt < 30 &&
        [...f.app.firestore.io.sockets.sockets.values()].some((s) =>
          s.rooms.has(`match:${id}`)
        );
        attempt++
      )
        await pause(50);
      for (const active of f.app.firestore.io.sockets.sockets.values())
        assert.equal(active.rooms.has(`match:${id}`), false);
      const disconnected = event(socket, "disconnect");
      now += 60_001;
      await disconnected;
      assert.equal(
        (await f.call("GET", "/v1/matches", a.token)).statusCode,
        401
      );
      const fresh = await f.login("A");
      const address = `http://127.0.0.1:${
        (f.app.server.address() as any).port
      }`;
      socket = io(address, {
        auth: { token: fresh.token },
        transports: ["websocket"],
        reconnection: false,
      });
      await event(socket, "connect");
      const loggedOut = event(socket, "disconnect");
      assert.equal(
        (await f.call("POST", "/v1/auth/logout", fresh.token)).statusCode,
        200
      );
      await loggedOut;
      assert.equal(
        (await f.call("GET", "/v1/matches", fresh.token)).statusCode,
        401
      );
    } finally {
      socket?.disconnect();
      await f.close();
    }
  }
);
