import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, copyFileSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname, basename } from "node:path";
import { spawnSync } from "node:child_process";
import { root, firestoreConfiguration } from "../common.mjs";

// Run the real launcher in a fresh checkout-shaped directory with no credentials.
function launch(args) {
  const fixture = mkdtempSync(join(tmpdir(), "gap-startup-"));
  try {
    mkdirSync(join(fixture, "scripts"));
    for (const file of ["demo.mjs", "setup.mjs", "common.mjs"])
      copyFileSync(join(root, "scripts", file), join(fixture, "scripts", file));
    // This fixture launches a one-shot fake Metro. Port probing belongs to the
    // real launcher, not this credential-free FE routing test.
    const launcher = join(fixture, "scripts", "demo.mjs");
    writeFileSync(launcher, readFileSync(launcher, "utf8").replace("const free = await isPortAvailable(port, host);", "const free = true;"));
    writeFileSync(join(fixture, ".env.example"), "DATABASE_MODE=old-sql\n");
    writeFileSync(join(fixture, "package.json"), JSON.stringify({
      scripts: { "dev:mobile": 'node -e "console.log(\'FE_READY_WITHOUT_SECRET\')"' },
    }));
    const env = { ...process.env };
    for (const name of ["DATABASE_MODE", "FIREBASE_PROJECT_ID", "GOOGLE_APPLICATION_CREDENTIALS", "FIRESTORE_EMULATOR_HOST"])
      delete env[name];
    return spawnSync(process.execPath, [join(fixture, "scripts", "demo.mjs"), ...args], {
      cwd: fixture, env, encoding: "utf8", windowsHide: true, timeout: 20_000,
    });
  } finally {
    assert.equal(dirname(resolve(fixture)), resolve(tmpdir()));
    assert.ok(basename(fixture).startsWith("gap-startup-"));
    rmSync(fixture, { recursive: true, force: true });
  }
}

test("BE loads local configuration and fails before starting with an unsupported DB", () => {
  const result = launch(["--api-only"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /DATABASE_MODE must be firestore/);
  assert.doesNotMatch(result.stdout, /FE_READY_WITHOUT_SECRET/);
});

test("FE launcher reaches Metro without a Firebase project or credential", async () => {
  const result = launch(["--mobile-only", "--no-android"]);
  assert.equal(result.error, undefined);
  assert.match(result.stdout, /FE_READY_WITHOUT_SECRET/);
  assert.doesNotMatch(result.stderr, /FIREBASE_PROJECT_ID|DATABASE_MODE must/);
});


test("cloud rejects demo and seed flags; production rejects emulator", () => {
  const base = { DATABASE_MODE: "firestore", FIREBASE_PROJECT_ID: "demo-app-cuoi-ky" };
  assert.throws(() => firestoreConfiguration({ ...base, DEMO_MODE: "true" }), /explicit firestore-emulator/);
  assert.throws(() => firestoreConfiguration({ ...base, FIRESTORE_SEED_DEMO: "true" }), /explicit firestore-emulator/);
  assert.throws(() => firestoreConfiguration({ ...base, NODE_ENV: "production", DATABASE_MODE: "firestore-emulator" }), /Production rejects/);
  assert.doesNotThrow(() => firestoreConfiguration(base));
});

test("launcher defaults to real-data mode without local env", () => {
  const fixture = mkdtempSync(join(tmpdir(), "gap-default-mode-"));
  try {
    mkdirSync(join(fixture, "scripts"));
    copyFileSync(join(root, "scripts/common.mjs"), join(fixture, "scripts/common.mjs"));
    const env = { ...process.env };
    delete env.DEMO_MODE;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", `import {environment} from ${JSON.stringify(new URL('file:///' + join(fixture, 'scripts/common.mjs').replaceAll('\\','/')).href)}; console.log(environment().DEMO_MODE)`], {env, encoding:"utf8"});
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "false");
  } finally { rmSync(fixture, {recursive:true, force:true}); }
});
