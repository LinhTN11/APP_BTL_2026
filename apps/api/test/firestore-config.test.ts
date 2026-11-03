import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { getApps } from "firebase-admin/app";
import { createFirestoreContext } from "../src/firestore/context.js";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
const trackedEnvironment = [
  "DEMO_MODE",
  "FIRESTORE_SEED_DEMO",
  "DATABASE_MODE",
  "FIRESTORE_EMULATOR_HOST",
  "FIREBASE_PROJECT_ID",
  "FIRESTORE_NAMESPACE",
  "GOOGLE_APPLICATION_CREDENTIALS",
] as const;

async function withEnvironment(
  values: Partial<Record<(typeof trackedEnvironment)[number], string | undefined>>,
  run: () => Promise<void>
) {
  const previous = Object.fromEntries(
    trackedEnvironment.map((key) => [key, process.env[key]])
  ) as Record<(typeof trackedEnvironment)[number], string | undefined>;
  for (const key of trackedEnvironment) {
    const value = values[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    await run();
  } finally {
    for (const key of trackedEnvironment) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function appNames() {
  return getApps()
    .map((app) => app.name)
    .sort();
}

test("Firestore config rejects unsafe modes before initializing an Admin SDK app", async () => {
  const cases: {
    label: string;
    values: Record<string, string>;
    options: { emulatorHost?: string };
    message: RegExp;
  }[] = [
    {
      label: "unknown database mode",
      values: { DATABASE_MODE: "sqlite" },
      options: {},
      message: /DATABASE_MODE must be firestore or firestore-emulator/,
    },
    {
      label: "emulator mode without a host",
      values: { DATABASE_MODE: "firestore-emulator" },
      options: {},
      message: /requires an explicit FIRESTORE_EMULATOR_HOST/,
    },
    {
      label: "cloud mode with an environment emulator host",
      values: {
        DATABASE_MODE: "firestore",
        FIRESTORE_EMULATOR_HOST: "127.0.0.1:8089",
      },
      options: {},
      message: /cannot be combined with an emulator host/,
    },
    {
      label: "cloud mode with an options emulator host",
      values: { DATABASE_MODE: "firestore" },
      options: { emulatorHost: "127.0.0.1:8089" },
      message: /cannot be combined with an emulator host/,
    },
    {
      label: "implicit emulator environment host",
      values: { FIRESTORE_EMULATOR_HOST: "127.0.0.1:8089" },
      options: {},
      message: /requires explicit DATABASE_MODE=firestore-emulator/,
    },
    {
      label: "non-loopback emulator host",
      values: {
        DATABASE_MODE: "firestore-emulator",
        FIRESTORE_EMULATOR_HOST: "0.0.0.0:8089",
      },
      options: {},
      message: /must be an explicit loopback host/,
    },
  ];

  for (const scenario of cases) {
    await withEnvironment(
      {
        DATABASE_MODE: scenario.values.DATABASE_MODE,
        FIRESTORE_EMULATOR_HOST: scenario.values.FIRESTORE_EMULATOR_HOST,
        FIREBASE_PROJECT_ID: undefined,
        FIRESTORE_NAMESPACE: undefined,
        GOOGLE_APPLICATION_CREDENTIALS: undefined,
      },
      async () => {
        const before = appNames();
        await assert.rejects(
          createFirestoreContext({
            projectId: "demo-app-cuoi-ky",
            namespace: "config-test",
            ...scenario.options,
          }),
          { message: scenario.message }
        );
        assert.deepEqual(
          appNames(),
          before,
          `${scenario.label} initialized an Admin app`
        );
      }
    );
  }
});

test("missing credential file fails before SDK initialization or credential access", async () => {
  const missingFile = `${process.cwd()}\\does-not-exist-${randomUUID()}.json`;
  await assert.rejects(access(missingFile, constants.R_OK));
  await withEnvironment(
    {
      DATABASE_MODE: "firestore",
      FIRESTORE_EMULATOR_HOST: undefined,
      FIREBASE_PROJECT_ID: undefined,
      FIRESTORE_NAMESPACE: undefined,
      GOOGLE_APPLICATION_CREDENTIALS: missingFile,
    },
    async () => {
      const before = appNames();
      await assert.rejects(
        createFirestoreContext({
          projectId: "demo-app-cuoi-ky",
          namespace: "config-test",
        }),
        /does not identify a readable credential file; no Firestore SDK was initialized/
      );
      assert.deepEqual(appNames(), before);
    }
  );
});

test(
  "explicit options emulator host connects when DATABASE_MODE is unset",
  {
    skip: emulatorHost
      ? false
      : "Actual Firestore emulator required at 127.0.0.1:8089.",
  },
  async () => {
    await withEnvironment(
      {
        DATABASE_MODE: undefined,
        FIRESTORE_EMULATOR_HOST: undefined,
        FIREBASE_PROJECT_ID: undefined,
        FIRESTORE_NAMESPACE: undefined,
        GOOGLE_APPLICATION_CREDENTIALS: undefined,
      },
      async () => {
        const context = await createFirestoreContext({
          projectId: "demo-app-cuoi-ky",
          namespace: `config-${randomUUID().slice(0, 8)}`,
          emulatorHost,
        });
        try {
          assert.equal(context.database.mode, "emulator");
        } finally {
          await context.close();
        }
      }
    );
  }
);


test("production rejects demo, seed and emulator before Admin initialization", async () => {
  const previous = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    const before = appNames();
    await assert.rejects(createFirestoreContext({projectId:"demo-app-cuoi-ky", emulatorHost: emulatorHost ?? "127.0.0.1:8089", demoMode:true}), /Production rejects/);
    await assert.rejects(createFirestoreContext({projectId:"demo-app-cuoi-ky", emulatorHost: emulatorHost ?? "127.0.0.1:8089", seedDemo:true}), /Production rejects/);
    assert.deepEqual(appNames(), before);
  } finally { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; }
});
