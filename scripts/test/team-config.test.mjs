import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createBundle, exportBundle, importBundle, main } from "../team-config.mjs";

const ROOT = new URL("../../", import.meta.url);
const rootPath = (relative) => fileURLToPath(new URL(relative, ROOT));
const project = "team-cloud-project-12345";
const privateKeyHeader = ["-----BEGIN ", "PRIVATE KEY-----"].join("");

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "team config isolated "));
  mkdirSync(join(root, "secrets"), { recursive: true });
  const serviceAccount = {
    type: "service_account",
    project_id: project,
    private_key_id: "fixture-only-key-id",
    private_key: `${privateKeyHeader}\nfixture-only-not-a-key\n-----END PRIVATE KEY-----\n`,
    client_email: "fixture@team-cloud-project-12345.iam.gserviceaccount.com",
    client_id: "1234567890",
    token_uri: "https://oauth2.googleapis.com/token",
  };
  const env = {
    DATABASE_MODE: "firestore",
    FIREBASE_PROJECT_ID: project,
    FIREBASE_API_KEY: "AIzaPublicFixtureClientConfig123456789012345678",
    FIREBASE_APP_ID: "1:123456789:web:abcdef123456",
    FIREBASE_AUTH_DOMAIN: "team-cloud-project-12345.firebaseapp.com",
    FIRESTORE_NAMESPACE: "shared-team-test",
    GOOGLE_WEB_CLIENT_ID: "123456789-public.apps.googleusercontent.com",
    DEMO_MODE: "false",
    FIRESTORE_SEED_DEMO: "false",
    PORT: "4321",
    HOST: "192.168.1.44",
  };
  env[["GOOGLE_APPLICATION_", "CREDENTIALS"].join("")] = "C:/never-included/local/credential.json";
  env[["SESSION_", "SECRET"].join("")] = "not-for-export";
  writeFileSync(join(root, "team-cloud.json"), `${JSON.stringify({ version: 1, projectId: project, namespace: "shared-team-test" }, null, 2)}\n`);
  const bundle = createBundle(env, JSON.stringify(serviceAccount));
  return { root, env, serviceAccount, bundle, text: `${JSON.stringify(bundle, null, 2)}\n`, close: () => rmSync(root, { recursive: true, force: true }) };
}

test("exports only allowlisted cloud config, writes ignored paths, and is idempotent", (t) => {
  const f = fixture(); t.after(f.close);
  const result = exportBundle({ root: f.root, env: f.env, credentialText: JSON.stringify(f.serviceAccount) });
  assert.equal(result.changed, true);
  const bundleText = readFileSync(result.path, "utf8");
  const parsed = JSON.parse(bundleText);
  assert.deepEqual(Object.keys(parsed.config).sort(), [
    "DATABASE_MODE", "DEMO_MODE", "FIREBASE_API_KEY", "FIREBASE_APP_ID", "FIREBASE_AUTH_DOMAIN",
    "FIREBASE_PROJECT_ID", "FIRESTORE_NAMESPACE", "FIRESTORE_SEED_DEMO", "GOOGLE_WEB_CLIENT_ID", "HOST", "PORT",
  ].sort());
  assert.equal(bundleText.includes("SESSION_SECRET"), false);
  assert.equal(bundleText.includes(f.env.GOOGLE_APPLICATION_CREDENTIALS), false);
  assert.equal(parsed.config.HOST, "0.0.0.0");
  assert.equal(parsed.config.PORT, "3000");
  assert.notEqual(f.env.HOST, parsed.config.HOST);
  assert.notEqual(f.env.PORT, parsed.config.PORT);
  const same = exportBundle({ root: f.root, env: f.env, credentialText: JSON.stringify(f.serviceAccount) });
  assert.equal(same.changed, false);

  const ignore = readFileSync(rootPath(".gitignore"), "utf8");
  writeFileSync(join(f.root, ".gitignore"), ignore);
  execFileSync("git", ["init", "-q"], { cwd: f.root });
  const ignored = execFileSync("git", ["check-ignore", ".env.local", "secrets/team-config.json", "secrets/team-firebase-service-account.json"], { cwd: f.root, encoding: "utf8" });
  assert.equal(ignored.trim().split(/\r?\n/).length, 3);
});

test("import uses a portable credential path, preserves unrelated settings, and repeats cleanly", (t) => {
  const f = fixture(); t.after(f.close);
  const template = "DATABASE_MODE=firestore\nFIREBASE_PROJECT_ID=\nFIREBASE_API_KEY=\nFIREBASE_APP_ID=\nFIREBASE_AUTH_DOMAIN=\nFIRESTORE_NAMESPACE=app-cuoi-ky\nGOOGLE_APPLICATION_CREDENTIALS=\nGOOGLE_WEB_CLIENT_ID=\nFIRESTORE_SEED_DEMO=false\nPORT=3000\nHOST=0.0.0.0\nDEMO_MODE=false\n";
  writeFileSync(join(f.root, ".env.example"), template);
  writeFileSync(join(f.root, ".env.local"), `DATABASE_MODE=firestore\nFIREBASE_PROJECT_ID=\nFIRESTORE_NAMESPACE=shared-team-test\nTEAM_NOTE=preserve-me\n`);
  const result = importBundle({ root: f.root, bundleText: f.text, templateText: template });
  assert.equal(result.changed, true);
  const env = readFileSync(join(f.root, ".env.local"), "utf8");
  assert.match(env, /FIREBASE_PROJECT_ID=team-cloud-project-12345/);
  assert.match(env, /FIRESTORE_NAMESPACE=shared-team-test/);
  const portable = env.match(/GOOGLE_APPLICATION_CREDENTIALS=(.+)/)?.[1];
  assert.equal(portable, join(f.root, "secrets", "team-firebase-service-account.json").replaceAll("\\", "/"));
  assert.equal(resolve(join(f.root, "apps", "api"), portable), result.credentialPath);
  assert.match(env, /TEAM_NOTE=preserve-me/);
  assert.doesNotMatch(env, /SESSION_SECRET|PRIVATE KEY/);
  assert.deepEqual(JSON.parse(readFileSync(result.credentialPath, "utf8")), f.serviceAccount);
  const backupsBeforeRepeat = readdirSync(join(f.root, "secrets", "team-setup-backups")).length;
  assert.equal(importBundle({ root: f.root, bundleText: f.text, templateText: template }).changed, false);
  assert.equal(readdirSync(join(f.root, "secrets", "team-setup-backups")).length, backupsBeforeRepeat);

  const generated = fixture(); t.after(generated.close);
  writeFileSync(join(generated.root, ".env.example"), template);
  writeFileSync(join(generated.root, ".env.local"), template);
  const templateImport = importBundle({ root: generated.root, bundleText: generated.text, templateText: template });
  assert.equal(templateImport.changed, true);
  assert.match(readFileSync(join(generated.root, ".env.local"), "utf8"), /FIRESTORE_NAMESPACE=shared-team-test/);
});

test("rejects cloud emulator, demo, malformed, and mismatched service-account bundles", (t) => {
  const f = fixture(); t.after(f.close);
  assert.throws(() => createBundle({ ...f.env, DATABASE_MODE: "firestore-emulator" }, JSON.stringify(f.serviceAccount)), /Cloud Firestore/);
  assert.throws(() => createBundle({ ...f.env, FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080" }, JSON.stringify(f.serviceAccount)), /Emulator/);
  assert.throws(() => createBundle({ ...f.env, FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099" }, JSON.stringify(f.serviceAccount)), /Emulator/);
  assert.throws(() => createBundle({ ...f.env, DEMO_MODE: "true" }, JSON.stringify(f.serviceAccount)), /demo or seed/);
  assert.throws(() => createBundle({ ...f.env, FIRESTORE_SEED_DEMO: "true" }, JSON.stringify(f.serviceAccount)), /demo or seed/);
  assert.throws(() => createBundle({ ...f.env, FIREBASE_AUTH_DOMAIN: "safe\nDATABASE_MODE=firestore-emulator" }, JSON.stringify(f.serviceAccount)), /Invalid FIREBASE_AUTH_DOMAIN/);
  assert.throws(() => createBundle({ ...f.env, FIREBASE_PROJECT_ID: `other-${project}` }, JSON.stringify(f.serviceAccount)), /does not match/);
  const emulatorBundle = structuredClone(f.bundle);
  emulatorBundle.config.DATABASE_MODE = "firestore-emulator";
  assert.throws(() => importBundle({ root: f.root, bundleText: JSON.stringify(emulatorBundle) }), /Cloud Firestore/);
  const mismatchedProject = "other-team-cloud-project-12345";
  const otherAccount = { ...f.serviceAccount, project_id: mismatchedProject, client_email: `fixture@${mismatchedProject}.iam.gserviceaccount.com` };
  const otherEnv = { ...f.env, FIREBASE_PROJECT_ID: mismatchedProject };
  const internallyValidOtherBundle = createBundle(otherEnv, JSON.stringify(otherAccount));
  assert.throws(() => importBundle({ root: f.root, bundleText: JSON.stringify(internallyValidOtherBundle) }), /team-cloud\.json/);
  const wrongNamespace = createBundle({ ...f.env, FIRESTORE_NAMESPACE: "another-valid-space" }, JSON.stringify(f.serviceAccount));
  assert.throws(() => importBundle({ root: f.root, bundleText: JSON.stringify(wrongNamespace) }), /team-cloud\.json/);
  assert.throws(() => exportBundle({ root: f.root, env: { ...f.env, FIRESTORE_NAMESPACE: "another-valid-space" }, credentialText: "malformed-secret-file" }), /team-cloud\.json/);
  const malformed = "{\"private_key\":\"do-not-echo-fixture\"";
  assert.throws(() => importBundle({ root: f.root, bundleText: malformed }), (error) => {
    assert.match(error.message, /not valid JSON/);
    assert.doesNotMatch(error.message, /do-not-echo-fixture/);
    return true;
  });
});

test("ADC-only export explains the missing file path without reading or printing credentials", async (t) => {
  const f = fixture(); t.after(f.close);
  const errors = [];
  const status = await main(["export"], { root: f.root, env: { ...f.env, GOOGLE_APPLICATION_CREDENTIALS: "" }, io: { log() {}, error(line) { errors.push(line); } } });
  assert.equal(status, 1);
  assert.match(errors.join("\n"), /ADC-only config cannot be exported/);
  assert.match(errors.join("\n"), /no IAM request was made/);
  assert.doesNotMatch(errors.join("\n"), /fixture-only-not-a-key|private_key/);
  assert.equal(existsSync(join(f.root, "secrets", "team-config.json")), false);
});

test("rejects populated wrong project or namespace before changing local files", (t) => {
  const f = fixture(); t.after(f.close);
  const oldEnv = "DATABASE_MODE=firestore\nFIREBASE_PROJECT_ID=other-cloud-project-12345\nFIRESTORE_NAMESPACE=old-space\nUNRELATED=keep\n";
  const oldAccount = "old-account-fixture-content";
  writeFileSync(join(f.root, ".env.local"), oldEnv);
  writeFileSync(join(f.root, "secrets", "team-firebase-service-account.json"), oldAccount);
  assert.throws(() => importBundle({ root: f.root, bundleText: f.text }), /project ID differs/);
  assert.equal(readFileSync(join(f.root, ".env.local"), "utf8"), oldEnv);
  assert.equal(readFileSync(join(f.root, "secrets", "team-firebase-service-account.json"), "utf8"), oldAccount);
  writeFileSync(join(f.root, ".env.local"), "DATABASE_MODE=firestore\nFIREBASE_PROJECT_ID=team-cloud-project-12345\nFIRESTORE_NAMESPACE=wrong-namespace\n");
  const envBefore = readFileSync(join(f.root, ".env.local"), "utf8");
  assert.throws(() => importBundle({ root: f.root, bundleText: f.text }), /namespace differs/);
  assert.equal(readFileSync(join(f.root, ".env.local"), "utf8"), envBefore);
});

test("requires a valid exact cloud manifest before importing onto a blank clone", (t) => {
  const f = fixture(); t.after(f.close);
  const fresh = mkdtempSync(join(tmpdir(), "team config without manifest "));
  t.after(() => rmSync(fresh, { recursive: true, force: true }));
  mkdirSync(join(fresh, "secrets"), { recursive: true });
  assert.throws(() => importBundle({ root: fresh, bundleText: f.text }), /team-cloud\.json/);
  assert.equal(existsSync(join(fresh, ".env.local")), false);
  assert.equal(existsSync(join(fresh, "secrets", "team-firebase-service-account.json")), false);
  writeFileSync(join(fresh, "team-cloud.json"), "{\"version\":1,\"projectId\":\"different-cloud-project-12345\",\"namespace\":\"shared-team-test\"}");
  assert.throws(() => importBundle({ root: fresh, bundleText: f.text }), /differs from team-cloud\.json/);
  assert.equal(existsSync(join(fresh, ".env.local")), false);
});

test("FE default import reads the stable project bundle with no cloud env or --file argument", async (t) => {
  const f = fixture(); t.after(f.close);
  const bundlePath = exportBundle({ root: f.root, env: f.env, credentialText: JSON.stringify(f.serviceAccount) }).path;
  assert.equal(bundlePath, join(f.root, "secrets", "team-config.json"));
  const messages = [];
  const status = await main(["import"], {
    root: f.root,
    runtimeEnv: {},
    io: { log(message) { messages.push(message); }, error(message) { messages.push(message); } },
  });
  assert.equal(status, 0, messages.join("\n"));
  assert.match(readFileSync(join(f.root, ".env.local"), "utf8"), /FIREBASE_PROJECT_ID=team-cloud-project-12345/);
  assert.doesNotMatch(messages.join("\n"), /private_key|fixture-only-not-a-key/);
});

test("missing default bundle gives concise Zalo path instructions without echoing content", async (t) => {
  const f = fixture(); t.after(f.close);
  const messages = [];
  const status = await main(["import"], {
    root: f.root,
    runtimeEnv: {},
    io: { log(message) { messages.push(message); }, error(message) { messages.push(message); } },
  });
  const output = messages.join("\n");
  assert.equal(status, 1);
  assert.match(output, /Download it from Zalo/);
  assert.match(output, /PROJECT_ROOT\/secrets\/team-config\.json/);
  assert.match(output, /npm run team:setup/);
  assert.doesNotMatch(output, /fixture-only-not-a-key|private_key|client_email/);
});

test("explicit --file import override remains supported", async (t) => {
  const f = fixture(); t.after(f.close);
  const override = join(f.root, "received-from-zalo.json");
  writeFileSync(override, f.text);
  const messages = [];
  const status = await main(["import", "--file", override], {
    root: f.root,
    runtimeEnv: {},
    io: { log(message) { messages.push(message); }, error(message) { messages.push(message); } },
  });
  assert.equal(status, 0, messages.join("\n"));
  assert.match(readFileSync(join(f.root, ".env.local"), "utf8"), /FIRESTORE_NAMESPACE=shared-team-test/);
});

test("rejects shell cloud overrides before changing local files", (t) => {
  const f = fixture(); t.after(f.close);
  const oldEnv = "UNRELATED=keep\n";
  const oldAccount = "old-account-content";
  writeFileSync(join(f.root, ".env.local"), oldEnv);
  writeFileSync(join(f.root, "secrets", "team-firebase-service-account.json"), oldAccount);
  for (const runtimeEnv of [
    { FIREBASE_PROJECT_ID: "different-cloud-project-12345" },
    { FIRESTORE_NAMESPACE: "different-namespace" },
    { FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080" },
    { GOOGLE_APPLICATION_CREDENTIALS: "other/service-account.json" },
  ]) {
    assert.throws(() => importBundle({ root: f.root, bundleText: f.text, runtimeEnv }), /Shell override/);
    assert.equal(readFileSync(join(f.root, ".env.local"), "utf8"), oldEnv);
    assert.equal(readFileSync(join(f.root, "secrets", "team-firebase-service-account.json"), "utf8"), oldAccount);
  }
});

test("rolls back credential replacement if the second atomic write fails", (t) => {
  const f = fixture(); t.after(f.close);
  const oldEnv = "UNRELATED=keep\n";
  const oldAccount = "old-credential-fixture";
  writeFileSync(join(f.root, ".env.local"), oldEnv);
  writeFileSync(join(f.root, "secrets", "team-firebase-service-account.json"), oldAccount);
  let writes = 0;
  assert.throws(() => importBundle({
    root: f.root,
    bundleText: f.text,
    atomicWriteImpl(file, contents, mode) {
      writes++;
      if (writes === 2) throw new Error("injected write failure");
      writeFileSync(file, contents, { mode });
    },
  }), /prior files were restored/);
  assert.equal(readFileSync(join(f.root, ".env.local"), "utf8"), oldEnv);
  assert.equal(readFileSync(join(f.root, "secrets", "team-firebase-service-account.json"), "utf8"), oldAccount);
});

test("different exports back up and atomically replace the canonical bundle", (t) => {
  const f = fixture(); t.after(f.close);
  const first = exportBundle({ root: f.root, env: f.env, credentialText: JSON.stringify(f.serviceAccount) });
  const altered = { ...f.env, FIREBASE_API_KEY: "AIzaAnotherPublicFixtureClientConfig1234567890" };
  const second = exportBundle({ root: f.root, env: altered, credentialText: JSON.stringify(f.serviceAccount) });
  assert.equal(first.path, second.path);
  assert.equal(JSON.parse(readFileSync(first.path, "utf8")).config.FIRESTORE_NAMESPACE, f.env.FIRESTORE_NAMESPACE);
  assert.equal(JSON.parse(readFileSync(second.path, "utf8")).config.FIREBASE_API_KEY, altered.FIREBASE_API_KEY);
  assert.equal(existsSync(second.path), true);
  const backupName = readdirSync(join(f.root, "secrets", "team-setup-backups")).find((name) => name.startsWith("secrets_team-config.json."));
  assert.ok(backupName);
  assert.equal(JSON.parse(readFileSync(join(f.root, "secrets", "team-setup-backups", backupName), "utf8")).config.FIREBASE_API_KEY, f.env.FIREBASE_API_KEY);
});
