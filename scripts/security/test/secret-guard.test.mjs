import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";
import test from "node:test";

const source = fileURLToPath(new URL("../secret-guard.mjs", import.meta.url));
const installer = fileURLToPath(new URL("../install-hooks.mjs", import.meta.url));
const hookDir = fileURLToPath(new URL("../../../.githooks/", import.meta.url));
const zero = "0".repeat(40);
const githubToken = () => ["ghp_", "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456"].join("");
const fineGrainedToken = () => ["github_pat_", "ABCDEFGHIJKLMNOPQRSTUVWXYZ_1234567890"].join("");
const openAiProjectKey = () => ["sk-proj-", "ABCDEFGHIJKLMNOPQRSTUVWXYZ_1234567890"].join("");
const stripeSecret = () => ["sk_live_", "1234567890abcdefghijklmn"].join("");

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "secret guard git "));
  mkdirSync(join(dir, "scripts", "security"), { recursive: true });
  writeFileSync(join(dir, "scripts", "security", "secret-guard.mjs"), readFileSync(source));
  mkdirSync(join(dir, ".githooks"), { recursive: true });
  for (const name of ["pre-commit", "pre-push"]) {
    const destination = join(dir, ".githooks", name);
    writeFileSync(destination, readFileSync(join(hookDir, name)));
    chmodSync(destination, 0o755);
  }
  const git = (args) => execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  git(["init", "-q"]);
  git(["config", "user.name", "Secret Guard Test"]);
  git(["config", "user.email", "secret-guard@example.invalid"]);
  const cli = (mode, input = "") => spawnSync(process.execPath, [join(dir, "scripts", "security", "secret-guard.mjs"), mode], { cwd: dir, encoding: "utf8", input });
  return { dir, git, cli, close: () => rmSync(dir, { recursive: true, force: true }) };
}

function put(dir, path, text) {
  const full = join(dir, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, text);
}

test("staged mode scans index blobs, not unstaged worktree changes", (t) => {
  const f = fixture(); t.after(f.close);
  put(f.dir, "src/config.ts", "export const value = 'safe';\n");
  f.git(["add", "src/config.ts"]);
  put(f.dir, "src/config.ts", `export const value = '${githubToken()}';\n`);
  let result = f.cli("staged");
  assert.equal(result.status, 0, result.stderr);
  put(f.dir, "src/config.ts", `export const token = '${githubToken()}';\n`);
  f.git(["add", "src/config.ts"]);
  put(f.dir, "src/config.ts", "export const value = 'working copy is harmless';\n");
  result = f.cli("staged");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /src\/config\.ts/);
  assert.doesNotMatch(result.stderr, new RegExp(githubToken()));
});

test("allows public Firebase client config in sanitized .env.example", (t) => {
  const f = fixture(); t.after(f.close);
  put(f.dir, ".env.example", "FIREBASE_API_KEY=AIzaSyPublicClientConfig123456789012345678\nGOOGLE_WEB_CLIENT_ID=1234567890-public.apps.googleusercontent.com\nGOOGLE_APPLICATION_CREDENTIALS=\nSTRIPE_SECRET_KEY=YOUR_STRIPE_SECRET_KEY\n");
  f.git(["add", ".env.example"]);
  const result = f.cli("staged");
  assert.equal(result.status, 0, result.stderr);
});

test("allows sanitized .env variant templates and rejects filled secret placeholders", (t) => {
  const f = fixture(); t.after(f.close);
  put(f.dir, ".env.dev.example", "FIREBASE_API_KEY=AIzaSyPublicClientConfig123456789012345678\nGOOGLE_WEB_CLIENT_ID=public.apps.googleusercontent.com\nSERVICE_TOKEN=\n");
  f.git(["add", ".env.dev.example"]);
  let result = f.cli("staged");
  assert.equal(result.status, 0, result.stderr);
  put(f.dir, ".env.dev.example", `FIREBASE_API_KEY=AIzaSyPublicClientConfig123456789012345678\nGOOGLE_WEB_CLIENT_ID=public.apps.googleusercontent.com\nSERVICE_TOKEN=${fineGrainedToken()}\n`);
  f.git(["add", ".env.dev.example"]);
  result = f.cli("staged");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /non-placeholder value/);
  assert.doesNotMatch(result.stderr, new RegExp(fineGrainedToken()));
});

test("rejects environment variants and sensitive filenames including spaces", (t) => {
  const f = fixture(); t.after(f.close);
  put(f.dir, ".env.production", "safe placeholder\n");
  put(f.dir, "config.env", "safe placeholder\n");
  put(f.dir, "secrets/service account.json", "safe placeholder\n");
  f.git(["add", ".env.production", "config.env", "secrets/service account.json"]);
  const result = f.cli("staged");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /\.env\.production/);
  assert.match(result.stderr, /config\.env/);
  assert.match(result.stderr, /secrets\/service account\.json/);
});

test("allows only the versioned Xcode environment script path and still scans its content", (t) => {
  const f = fixture(); t.after(f.close);
  put(f.dir, "apps/mobile/ios/.xcode.env", "export NODE_BINARY=$(command -v node)\n");
  f.git(["add", "apps/mobile/ios/.xcode.env"]);
  let result = f.cli("staged");
  assert.equal(result.status, 0, result.stderr);
  put(f.dir, "apps/other/.xcode.env", "export NODE_BINARY=$(command -v node)\n");
  f.git(["add", "apps/other/.xcode.env"]);
  result = f.cli("staged");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /apps\/other\/\.xcode\.env/);
  f.git(["reset", "-q", "--", "apps/other/.xcode.env"]);
  put(f.dir, "apps/mobile/ios/.xcode.env", `export NODE_BINARY=$(command -v node)\nTOKEN=${githubToken()}\n`);
  f.git(["add", "apps/mobile/ios/.xcode.env"]);
  result = f.cli("staged");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /apps\/mobile\/ios\/\.xcode\.env/);
  assert.doesNotMatch(result.stderr, new RegExp(githubToken()));
});

test("detects credential content without printing matched value", (t) => {
  const f = fixture(); t.after(f.close);
  const secret = githubToken();
  put(f.dir, "src/token file.ts", `const token = "${secret}";\n`);
  f.git(["add", "src/token file.ts"]);
  const result = f.cli("staged");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /src\/token file\.ts/);
  assert.doesNotMatch(result.stderr, new RegExp(secret));
});

test("pre-push catches a secret in an outgoing commit even after later deletion", (t) => {
  const f = fixture(); t.after(f.close);
  put(f.dir, "src/config.ts", `const token = "${stripeSecret()}";\n`);
  f.git(["add", "src/config.ts"]); f.git(["commit", "-qm", "introduce secret fixture"]);
  put(f.dir, "src/config.ts", "export const safe = true;\n");
  f.git(["add", "src/config.ts"]); f.git(["commit", "-qm", "remove secret fixture"]);
  const head = f.git(["rev-parse", "HEAD"]).trim();
  const result = f.cli("pre-push", `refs/heads/topic ${head} refs/heads/topic ${zero}\n`);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /outgoing commit/);
  assert.doesNotMatch(result.stderr, new RegExp(stripeSecret()));
});

test("pre-push ignores remote ref deletions and fails closed on git errors", (t) => {
  const f = fixture(); t.after(f.close);
  const deleted = f.cli("pre-push", `(delete) ${zero} refs/heads/old ${"1".repeat(40)}\n`);
  assert.equal(deleted.status, 0, deleted.stderr);
  const outside = mkdtempSync(join(tmpdir(), "not a git repo "));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  const outsideScript = join(outside, "scripts", "security", "secret-guard.mjs");
  mkdirSync(dirname(outsideScript), { recursive: true });
  writeFileSync(outsideScript, readFileSync(source));
  const result = spawnSync(process.execPath, [outsideScript, "staged"], { cwd: outside, encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /failed closed/);
});

test("pre-push handles known branch/tag bases and malformed input safely", (t) => {
  const f = fixture(); t.after(f.close);
  put(f.dir, "README.md", "fixture base\n");
  f.git(["add", "README.md"]); f.git(["commit", "-qm", "base"]);
  put(f.dir, "src/safe.ts", "export const safe = true;\n");
  f.git(["add", "src/safe.ts"]); f.git(["commit", "-qm", "safe history"]);
  const head = f.git(["rev-parse", "HEAD"]).trim();
  const previous = f.git(["rev-parse", "HEAD^"]).trim();
  const branch = f.cli("pre-push", `refs/heads/topic ${head} refs/heads/topic ${previous}\n`);
  assert.equal(branch.status, 0, branch.stderr);
  const tag = f.cli("pre-push", `refs/tags/v1 ${head} refs/tags/v1 ${zero}\n`);
  assert.equal(tag.status, 0, tag.stderr);
  const malformed = f.cli("pre-push", `refs/heads/topic ${head} refs/heads/topic\n`);
  assert.equal(malformed.status, 2);
  assert.match(malformed.stderr, /failed closed/);
});

test("range mode scans full new history and only commits after a known base", (t) => {
  const f = fixture(); t.after(f.close);
  put(f.dir, "src/old.ts", `const token = "${githubToken()}";\n`);
  f.git(["add", "src/old.ts"]); f.git(["commit", "-qm", "credential fixture"]);
  const base = f.git(["rev-parse", "HEAD"]).trim();
  put(f.dir, "src/old.ts", "export const safe = true;\n");
  f.git(["add", "src/old.ts"]); f.git(["commit", "-qm", "remove credential fixture"]);
  const head = f.git(["rev-parse", "HEAD"]).trim();
  const full = spawnSync(process.execPath, [join(f.dir, "scripts/security/secret-guard.mjs"), "range", zero, head], { cwd: f.dir, encoding: "utf8" });
  assert.equal(full.status, 1);
  assert.doesNotMatch(full.stderr, new RegExp(githubToken()));
  const incremental = spawnSync(process.execPath, [join(f.dir, "scripts/security/secret-guard.mjs"), "range", base, head], { cwd: f.dir, encoding: "utf8" });
  assert.equal(incremental.status, 0, incremental.stderr);
});

test("detects GitHub fine-grained and OpenAI project keys", (t) => {
  const f = fixture(); t.after(f.close);
  for (const [path, value] of [["src/github.ts", fineGrainedToken()], ["src/openai.ts", openAiProjectKey()]]) {
    put(f.dir, path, `const apiKey = "${value}";\n`);
    f.git(["add", path]);
  }
  const result = f.cli("staged");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /src\/github\.ts/);
  assert.match(result.stderr, /src\/openai\.ts/);
  assert.doesNotMatch(result.stderr, new RegExp(fineGrainedToken()));
  assert.doesNotMatch(result.stderr, new RegExp(openAiProjectKey()));
});

test("detects renamed service-account JSON and private-key block content", (t) => {
  const f = fixture(); t.after(f.close);
  const keyHeader = ["-----BEGIN ", "PRIVATE KEY-----"].join("");
  const json = ["{\"type\":\"service_", "account\",\"private_key_", "id\":\"fixture\"}"].join("");
  put(f.dir, "config/renamed.json", `${json}\n`);
  put(f.dir, "config/identity.txt", `${keyHeader}\nfixture-only\n`);
  f.git(["add", "config/renamed.json", "config/identity.txt"]);
  const result = f.cli("staged");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /service account credential/);
  assert.match(result.stderr, /private key block/);
  assert.doesNotMatch(result.stderr, /fixture-only/);
});

test("the guard can scan its own staged implementation, tests, docs, hooks, and workflow", (t) => {
  const f = fixture(); t.after(f.close);
  const files = [
    ["scripts/security/secret-guard.mjs", source],
    ["scripts/security/install-hooks.mjs", installer],
    ["scripts/security/test/secret-guard.test.mjs", fileURLToPath(import.meta.url)],
    [".githooks/pre-commit", join(hookDir, "pre-commit")],
    [".githooks/pre-push", join(hookDir, "pre-push")],
    ["apps/mobile/ios/.xcode.env", fileURLToPath(new URL("../../../apps/mobile/ios/.xcode.env", import.meta.url))],
    ["docs/security/secrets.md", fileURLToPath(new URL("../../../docs/security/secrets.md", import.meta.url))],
    [".github/workflows/secret-guard.yml", fileURLToPath(new URL("../../../.github/workflows/secret-guard.yml", import.meta.url))],
  ];
  for (const [target, origin] of files) {
    put(f.dir, target, readFileSync(origin));
    f.git(["add", target]);
  }
  const staged = f.cli("staged");
  assert.equal(staged.status, 0, staged.stderr);
  const tracked = f.cli("tracked");
  assert.equal(tracked.status, 0, tracked.stderr);
});

test("hook installer preserves a pre-existing non-owned hooksPath", (t) => {
  const f = fixture(); t.after(f.close);
  const installPath = join(f.dir, "scripts", "security", "install-hooks.mjs");
  writeFileSync(installPath, readFileSync(installer));
  f.git(["config", "--local", "core.hooksPath", "custom-hooks"]);
  const refused = spawnSync(process.execPath, [installPath], { cwd: f.dir, encoding: "utf8" });
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /was preserved/);
  assert.equal(f.git(["config", "--local", "--get", "core.hooksPath"]).trim(), "custom-hooks");
  f.git(["config", "--local", "--unset", "core.hooksPath"]);
  const installed = spawnSync(process.execPath, [installPath], { cwd: f.dir, encoding: "utf8" });
  assert.equal(installed.status, 0, installed.stderr);
  assert.equal(f.git(["config", "--local", "--get", "core.hooksPath"]).trim(), ".githooks");
  if (process.platform !== "win32") {
    const { mode } = statSync(join(f.dir, ".githooks", "pre-commit"));
    assert.ok(mode & 0o100, "pre-commit must be executable after installation");
  }
});

test("hook installer preserves effective global hooksPath and active legacy hooks", (t) => {
  const f = fixture(); t.after(f.close);
  const installPath = join(f.dir, "scripts", "security", "install-hooks.mjs");
  writeFileSync(installPath, readFileSync(installer));
  const globalConfig = join(f.dir, "global.gitconfig");
  execFileSync("git", ["config", "--file", globalConfig, "core.hooksPath", "custom-global-hooks"]);
  const globalResult = spawnSync(process.execPath, [installPath], {
    cwd: f.dir, encoding: "utf8", env: { ...process.env, GIT_CONFIG_GLOBAL: globalConfig },
  });
  assert.equal(globalResult.status, 1);
  assert.match(globalResult.stderr, /effective core\.hooksPath/);
  assert.equal(spawnSync("git", ["config", "--local", "--get", "core.hooksPath"], { cwd: f.dir, encoding: "utf8" }).status, 1);

  const gitHooks = f.git(["rev-parse", "--git-path", "hooks"]).trim();
  const existingHook = join(f.dir, gitHooks, "pre-commit");
  mkdirSync(dirname(existingHook), { recursive: true });
  writeFileSync(existingHook, "#!/bin/sh\nexit 0\n");
  const legacyResult = spawnSync(process.execPath, [installPath], { cwd: f.dir, encoding: "utf8" });
  assert.equal(legacyResult.status, 1);
  assert.match(legacyResult.stderr, /active hook\(s\) already exist/);
  assert.equal(spawnSync("git", ["config", "--local", "--get", "core.hooksPath"], { cwd: f.dir, encoding: "utf8" }).status, 1);
});

test("installed pre-commit hook rejects a staged credential", (t) => {
  const f = fixture(); t.after(f.close);
  f.git(["config", "--local", "core.hooksPath", ".githooks"]);
  put(f.dir, "src/token.ts", `const token = '${githubToken()}';\n`);
  f.git(["add", "src/token.ts"]);
  const result = spawnSync("git", ["commit", "-m", "fixture credential"], { cwd: f.dir, encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Secret guard/);
  assert.doesNotMatch(result.stderr, new RegExp(githubToken()));
});

test("actual pre-push hook blocks deleted secret history and allows a safe branch to a local bare remote", (t) => {
  const f = fixture(); t.after(f.close);
  const remote = mkdtempSync(join(tmpdir(), "secret guard bare remote "));
  t.after(() => rmSync(remote, { recursive: true, force: true }));
  execFileSync("git", ["init", "--bare", "-q", remote]);
  f.git(["remote", "add", "origin", remote]);

  put(f.dir, "README.md", "safe base\n");
  f.git(["add", "README.md"]); f.git(["commit", "-qm", "safe base"]);
  const safeBase = f.git(["rev-parse", "HEAD"]).trim();

  f.git(["switch", "-qc", "secret-history"]);
  put(f.dir, "src/credential.ts", `const token = "${githubToken()}";\n`);
  f.git(["add", "src/credential.ts"]); f.git(["commit", "-qm", "add credential fixture"]);
  f.git(["rm", "-q", "src/credential.ts"]); f.git(["commit", "-qm", "remove credential fixture"]);

  f.git(["config", "--local", "core.hooksPath", ".githooks"]);
  const blocked = spawnSync("git", ["push", "origin", "secret-history:refs/heads/secret-history"], { cwd: f.dir, encoding: "utf8" });
  assert.notEqual(blocked.status, 0);
  assert.match(blocked.stderr, /Secret guard/);
  assert.doesNotMatch(blocked.stderr, new RegExp(githubToken()));

  f.git(["switch", "-qc", "clean-push", safeBase]);
  put(f.dir, "src/clean.ts", "export const ready = true;\n");
  f.git(["add", "src/clean.ts"]); f.git(["commit", "-qm", "safe branch"]);
  const passed = spawnSync("git", ["push", "origin", "clean-push:refs/heads/clean-push"], { cwd: f.dir, encoding: "utf8" });
  assert.equal(passed.status, 0, passed.stderr);
});
