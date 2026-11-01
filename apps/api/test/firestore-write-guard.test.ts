import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { request } from "node:http";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFirestoreApp } from "../src/firestore/app.js";
import { demoIds } from "../src/firestore/seed.js";
import { hash } from "../src/firestore/context.js";

const host = process.env.FIRESTORE_EMULATOR_HOST;
const opts = {
  skip: host
    ? false
    : "Actual Firestore emulator required: set FIRESTORE_EMULATOR_HOST. No mock/cloud fallback.",
};
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test(
  "Firestore write guard: logout, expiry or account disable during slow multipart cannot commit media or leave a file",
  opts,
  async () => {
    let now = Date.UTC(2026, 10, 1);
    const dir = await mkdtemp(join(tmpdir(), "gap-firestore-guard-"));
    const app = await createFirestoreApp({
      projectId: "demo-app-cuoi-ky",
      emulatorHost: host,
      namespace: `test-${randomUUID()}`,
      dataDir: dir,
      demoMode: true,
      seedDemo: true,
      now: () => now,
      sessionTtlMs: 60_000,
    });
    try {
      const address = await app.listen({ host: "127.0.0.1", port: 0 });
      const bytes = await readFile(join(dir, "media", "seed-A.png"));
      const mediaDir = join(dir, "media");
      const beforeFiles = (await readdir(mediaDir)).sort();
      const beforeIds = (
        await app.firestore.ref("profiles", demoIds.A).get()
      ).data()!.mediaIds;
      const login = async () => {
        const result = await app.inject({
          method: "POST",
          url: "/v1/demo/sessions",
          payload: { account: "A" },
        });
        assert.equal(result.statusCode, 200);
        return result.json().data.token as string;
      };
      async function slowUpload(
        token: string,
        afterStarted: () => Promise<void>
      ) {
        const boundary = `gap-${randomUUID()}`;
        const head = Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="image.png"\r\nContent-Type: image/png\r\n\r\n`
        );
        const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
        const url = new URL(address);
        const outcome = new Promise<{ status: number; body: any }>(
          (resolve, reject) => {
            const stream = request(
              {
                hostname: url.hostname,
                port: url.port,
                path: "/v1/me/media",
                method: "POST",
                headers: {
                  authorization: `Bearer ${token}`,
                  "content-type": `multipart/form-data; boundary=${boundary}`,
                },
              },
              (response) => {
                const chunks: Buffer[] = [];
                response.on("data", (chunk) => chunks.push(chunk));
                response.on("end", () =>
                  resolve({
                    status: response.statusCode!,
                    body: JSON.parse(Buffer.concat(chunks).toString()),
                  })
                );
              }
            );
            stream.on("error", reject);
            stream.write(Buffer.concat([head, bytes.subarray(0, 4)]));
            void (async () => {
              try {
                await pause(800);
                await afterStarted();
                stream.end(Buffer.concat([bytes.subarray(4), tail]));
              } catch (error) {
                stream.destroy(error as Error);
              }
            })();
          }
        );
        return outcome;
      }
      const logoutToken = await login();
      const revoked = await slowUpload(logoutToken, async () => {
        const result = await app.inject({
          method: "POST",
          url: "/v1/auth/logout",
          headers: { authorization: `Bearer ${logoutToken}` },
        });
        assert.equal(result.statusCode, 200);
      });
      assert.equal(revoked.status, 401, JSON.stringify(revoked.body));
      assert.equal(revoked.body.error.code, "SESSION_EXPIRED");
      const expiryToken = await login();
      const expired = await slowUpload(expiryToken, async () => {
        now += 60_001;
      });
      assert.equal(expired.status, 401, JSON.stringify(expired.body));
      assert.equal(expired.body.error.code, "SESSION_EXPIRED");
      const disabledToken = await login();
      const disabled = await slowUpload(disabledToken, async () => {
        await app.firestore
          .ref("users", demoIds.A)
          .update({ accountStatus: "disabled" });
      });
      assert.equal(disabled.status, 401, JSON.stringify(disabled.body));
      assert.equal(disabled.body.error.code, "SESSION_EXPIRED");
      assert.deepEqual(
        (await app.firestore.ref("profiles", demoIds.A).get()).data()!.mediaIds,
        beforeIds
      );
      assert.equal(
        (
          await app.firestore
            .collection("media")
            .where("userId", "==", demoIds.A)
            .get()
        ).size,
        beforeIds.length
      );
      assert.deepEqual((await readdir(mediaDir)).sort(), beforeFiles);
    } finally {
      await app.firestore.db.recursiveDelete(app.firestore.root);
      await app.close();
      await rm(dir, { recursive: true, force: true });
    }
  }
);

test(
  "Firestore write guard: every own-data mutation rejects a session revoked after request auth",
  opts,
  async () => {
    const dir = await mkdtemp(join(tmpdir(), "gap-firestore-mutations-"));
    const app = await createFirestoreApp({
      projectId: "demo-app-cuoi-ky",
      emulatorHost: host,
      namespace: `test-${randomUUID()}`,
      dataDir: dir,
      demoMode: true,
      seedDemo: true,
    });
    try {
      const bytes = await readFile(join(dir, "media", "seed-A.png"));
      const boundary = "gap-write-guard-boundary";
      const multipart = Buffer.concat([
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="image.png"\r\nContent-Type: image/png\r\n\r\n`
        ),
        bytes,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);
      const seeded = "10000000-0000-4000-8000-000000000001";
      const cases: [string, string, unknown, Record<string, string>?][] = [
        ["PATCH", "/v1/me/profile", { bio: "Rejected update" }],
        ["PATCH", "/v1/me/preferences", { minAge: 25 }],
        [
          "PUT",
          "/v1/me/location",
          { latitude: 10.7, longitude: 106.6, consent: true },
        ],
        ["DELETE", "/v1/me/location", undefined],
        [
          "POST",
          "/v1/me/media",
          multipart,
          { "content-type": `multipart/form-data; boundary=${boundary}` },
        ],
        ["PATCH", "/v1/me/media/order", { mediaIds: [seeded] }],
        ["DELETE", `/v1/me/media/${seeded}`, undefined],
        [
          "POST",
          "/v1/me/verification/selfie",
          multipart,
          { "content-type": `multipart/form-data; boundary=${boundary}` },
        ],
      ];
      const before = {
        profile: (await app.firestore.ref("profiles", demoIds.A).get()).data(),
        preferences: (
          await app.firestore.ref("preferences", demoIds.A).get()
        ).data(),
        location: (
          await app.firestore.ref("locations", demoIds.A).get()
        ).data(),
        media: (await app.firestore.ref("media", seeded).get()).data(),
        files: (await readdir(join(dir, "media"))).sort(),
      };
      for (const [method, url, payload, extraHeaders] of cases) {
        const login = await app.inject({
          method: "POST",
          url: "/v1/demo/sessions",
          payload: { account: "A" },
        });
        assert.equal(login.statusCode, 200);
        const token = login.json().data.token as string;
        const db = app.firestore.db as any,
          original = db.runTransaction.bind(db);
        let entered!: () => void,
          release!: () => void,
          first = true;
        const atTransaction = new Promise<void>((resolve) => {
          entered = resolve;
        });
        const go = new Promise<void>((resolve) => {
          release = resolve;
        });
        db.runTransaction = async (...args: any[]) => {
          if (first) {
            first = false;
            entered();
            await go;
          }
          return original(...args);
        };
        try {
          const pending: Promise<any> = Promise.resolve(
            app.inject({
              method: method as any,
              url,
              headers: { authorization: `Bearer ${token}`, ...extraHeaders },
              ...(payload === undefined ? {} : { payload }),
            } as any)
          );
          let timeout: NodeJS.Timeout | undefined;
          try {
            await Promise.race([
              atTransaction,
              new Promise<never>((_, reject) => {
                timeout = setTimeout(
                  () =>
                    reject(Error(`Transaction not reached: ${method} ${url}`)),
                  5000
                );
              }),
            ]);
          } finally {
            if (timeout) clearTimeout(timeout);
          }
          await app.firestore
            .ref("sessions", hash(token))
            .update({ revokedAt: app.firestore.config.now() });
          release();
          const result = await pending;
          assert.equal(
            result.statusCode,
            401,
            `${method} ${url}: ${result.body}`
          );
          assert.equal(result.json().error.code, "SESSION_EXPIRED");
        } finally {
          release();
          db.runTransaction = original;
        }
      }
      assert.deepEqual(
        (await app.firestore.ref("profiles", demoIds.A).get()).data(),
        before.profile
      );
      assert.deepEqual(
        (await app.firestore.ref("preferences", demoIds.A).get()).data(),
        before.preferences
      );
      assert.deepEqual(
        (await app.firestore.ref("locations", demoIds.A).get()).data(),
        before.location
      );
      assert.deepEqual(
        (await app.firestore.ref("media", seeded).get()).data(),
        before.media
      );
      assert.equal(
        (await app.firestore.collection("verificationRequests").get()).size,
        0
      );
      assert.equal(
        (
          await app.firestore
            .collection("media")
            .where("userId", "==", demoIds.A)
            .get()
        ).size,
        1
      );
      assert.deepEqual(
        (await readdir(join(dir, "media"))).sort(),
        before.files
      );
    } finally {
      await app.firestore.db.recursiveDelete(app.firestore.root);
      await app.close();
      await rm(dir, { recursive: true, force: true });
    }
  }
);
