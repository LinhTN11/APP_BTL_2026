#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(scriptDir, "../..");

const rules = [
  ["private key block", /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/i],
  ["service account credential", /"type"\s*:\s*"service_account"/i],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{20,}\b/],
  ["GitHub fine-grained token", /\bgithub_pat_[A-Za-z0-9_]{20,}\b/],
  ["OpenAI project secret key", /\bsk-proj-[A-Za-z0-9_-]{20,}\b/],
  ["Google OAuth client secret", /\bGOCSPX-[A-Za-z0-9_-]{12,}\b/],
  ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
  ["Stripe secret key", /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/],
  ["Firebase service credential", /"private_key_id"\s*:/i],
  ["provider bearer token", /\bBearer\s+[A-Za-z0-9._~+\/-]{24,}={0,2}/i],
];

const dangerousAssignmentLine = /^\s*(?:export\s+)?([A-Z][A-Z0-9_]{2,})\s*[:=]\s*(.*?)\s*$/;

function git(args, options = {}) {
  try {
    return execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "buffer",
      stdio: [options.input ? "pipe" : "ignore", "pipe", "pipe"],
      input: options.input,
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    throw new Error(`git ${args[0]} failed; check repository state and Git availability`);
  }
}

function nulFields(buffer) {
  return buffer.toString("utf8").split("\0").filter(Boolean);
}

function lines(buffer) {
  return buffer.toString("utf8").split(/\r?\n/).filter(Boolean);
}

function normalizePath(path) {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}

export function filenameFindings(path) {
  const normalized = normalizePath(path).toLowerCase();
  const base = normalized.slice(normalized.lastIndexOf("/") + 1);
  const findings = [];
  if (/(^|\/)secrets?(\/|$)/i.test(normalized)) findings.push("secret directory");
  const envTemplate = /^\.env(?:\..+)?\.example$/i.test(base);
  const versionedXcodeEnv = normalized === "apps/mobile/ios/.xcode.env";
  if (/(?:^|[._-])env(?:[._-]|$)/i.test(base) && !envTemplate && !versionedXcodeEnv)
    findings.push("environment file (only sanitized .env*.example templates are allowed)");
  if (/service[-_]?account|firebase[-_]?adminsdk/i.test(base))
    findings.push("service account filename");
  if (/\.(?:pem|p12|pfx|jks|keystore|key)$/i.test(base) && normalized !== "apps/mobile/android/app/debug.keystore")
    findings.push("private key or keystore filename");
  return findings;
}

function contentFindings(path, bytes) {
  const text = bytes.toString("utf8");
  const isTemplate = /^\.env(?:\..+)?\.example$/i.test(normalizePath(path).toLowerCase().split("/").at(-1));
  const findings = [];
  for (const [label, pattern] of rules) {
    if (pattern.test(text)) findings.push(label);
  }
  if (!isTemplate) {
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(dangerousAssignmentLine);
      if (!match) continue;
      const key = match[1].toUpperCase();
      const value = match[2].split(/\s+#/, 1)[0].replace(/[,;]+$/, "").replace(/^['"]|['"]$/g, "");
      const secretKey = /(?:SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE_KEY|CREDENTIAL|ACCESS_KEY)/.test(key);
      const placeholder = /^(?:"?YOUR_|"?CHANGEME|"?REPLACE_ME|<|\$\{|\*{3}|example|placeholder|dummy|test_only|undefined|missing\w*|\s*$)/i.test(value);
      const credentialPath = /(?:^|[\\/])[^\s]+\.(?:json|pem|p12|pfx)$/i.test(value);
      if (secretKey && !placeholder && !(key.includes("CREDENTIAL") && credentialPath) && value.length >= 12) findings.push("secret-like assignment");
    }
  }
  if (isTemplate) {
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*[:=]\s*(.*?)\s*$/i);
      if (!match) continue;
      const key = match[1].toUpperCase();
      const value = match[2].replace(/^['"]|['"]$/g, "");
      const secretKey = /(?:SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE_KEY|CREDENTIAL|ACCESS_KEY)/.test(key);
      const publicFirebaseKey = key === "FIREBASE_API_KEY";
      if (secretKey && !publicFirebaseKey && value.length >= 8 && !/^(?:YOUR_|CHANGEME|REPLACE_ME|<|\$\{|\*{3}|example|placeholder|dummy|test_only)/i.test(value))
        findings.push("non-placeholder value in .env.example");
    }
  }
  return [...new Set(findings)];
}

function report(findings) {
  for (const finding of findings)
    console.error(`Secret guard: ${finding.path}: ${finding.reason}`);
  if (findings.length) {
    console.error("Secret guard blocked this operation. Remove the file/value from the Git index/history; secret values are never printed.");
    return 1;
  }
  console.log("Secret guard: no prohibited filenames or credential patterns found.");
  return 0;
}

function cachedContentFindings(path, objectId, cache) {
  const key = `${path}\0${objectId}`;
  if (!cache.has(key)) cache.set(key, contentFindings(path, git(["cat-file", "blob", objectId])));
  return cache.get(key);
}

function staged() {
  // Read index object IDs, never the worktree version. Sensitive paths are
  // rejected from their names before opening any staged blob.
  const entries = nulFields(git(["ls-files", "--stage", "-z"]));
  const findings = [];
  for (const entry of entries) {
    const tab = entry.indexOf("\t");
    if (tab < 0) throw new Error("could not parse git index entry");
    const [mode, objectId, stage] = entry.slice(0, tab).split(" ");
    const path = entry.slice(tab + 1);
    if (stage !== "0") continue;
    const names = filenameFindings(path);
    if (names.length) {
      findings.push({ path, reason: names.join(", ") });
      continue;
    }
    if (mode === "160000") continue;
    const blob = git(["cat-file", "blob", objectId]);
    for (const reason of contentFindings(path, blob)) findings.push({ path, reason });
  }
  return report(findings);
}

function tracked() {
  const files = nulFields(git(["ls-files", "-z"]));
  const findings = [];
  for (const path of files) {
    const names = filenameFindings(path);
    if (names.length) {
      findings.push({ path, reason: names.join(", ") });
      continue;
    }
    const absolute = resolve(repoRoot, path);
    if (!absolute.startsWith(`${repoRoot}${sep}`)) throw new Error("tracked path escapes repository");
    let bytes;
    try { bytes = readFileSync(absolute); } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    for (const reason of contentFindings(path, bytes)) findings.push({ path, reason });
  }
  return report(findings);
}

function parsePushRefs(input) {
  const refs = [];
  for (const line of input.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const fields = line.split(/\s+/);
    if (fields.length !== 4) throw new Error("could not parse pre-push ref input");
    const [localRef, localSha, remoteRef, remoteSha] = fields;
    if (/^0+$/.test(localSha)) continue; // deleted remote ref
    refs.push({ localRef, localSha, remoteRef, remoteSha });
  }
  return refs;
}

function treeEntries(revision) {
  return nulFields(git(["ls-tree", "-r", "-z", revision])).map((field) => {
    const tab = field.indexOf("\t");
    if (tab < 0) throw new Error("could not parse git tree entry");
    const [mode, type, objectId] = field.slice(0, tab).split(" ");
    return { mode, type, objectId, path: field.slice(tab + 1) };
  });
}

function prePush(input) {
  const refs = parsePushRefs(input);
  const findings = [];
  const scanned = new Set();
  const contentCache = new Map();
  for (const ref of refs) {
    let revisions;
    if (/^0+$/.test(ref.remoteSha)) {
      revisions = lines(git(["rev-list", ref.localSha]));
    } else {
      revisions = lines(git(["rev-list", ref.localSha, "--not", ref.remoteSha]));
    }
    for (const revision of revisions) {
      if (scanned.has(revision)) continue;
      scanned.add(revision);
      for (const entry of treeEntries(revision)) {
        if (entry.type !== "blob" || entry.mode === "160000") continue;
        const names = filenameFindings(entry.path);
        if (names.length) {
          findings.push({ path: entry.path, reason: `${names.join(", ")} in outgoing commit ${revision.slice(0, 12)}` });
          continue;
        }
        for (const reason of cachedContentFindings(entry.path, entry.objectId, contentCache))
          findings.push({ path: entry.path, reason: `${reason} in outgoing commit ${revision.slice(0, 12)}` });
      }
    }
  }
  return report(findings);
}

function commitRange(base, head) {
  const revisions = /^0+$/.test(base)
    ? lines(git(["rev-list", head]))
    : lines(git(["rev-list", head, "--not", base]));
  const findings = [];
  const contentCache = new Map();
  for (const revision of revisions) {
    for (const entry of treeEntries(revision)) {
      if (entry.type !== "blob" || entry.mode === "160000") continue;
      const names = filenameFindings(entry.path);
      if (names.length) {
        findings.push({ path: entry.path, reason: `${names.join(", ")} in commit ${revision.slice(0, 12)}` });
        continue;
      }
      for (const reason of cachedContentFindings(entry.path, entry.objectId, contentCache))
        findings.push({ path: entry.path, reason: `${reason} in commit ${revision.slice(0, 12)}` });
    }
  }
  return report(findings);
}

const mode = process.argv[2];
try {
  let status;
  if (mode === "staged") status = staged();
  else if (mode === "tracked") status = tracked();
  else if (mode === "pre-push") status = prePush(readFileSync(0, "utf8"));
  else if (mode === "range" && process.argv.length === 5) status = commitRange(process.argv[3], process.argv[4]);
  else throw new Error("usage: secret-guard.mjs <staged|tracked|pre-push|range BASE_SHA HEAD_SHA>");
  process.exitCode = status;
} catch (error) {
  console.error(`Secret guard failed closed: ${error.message}`);
  process.exitCode = 2;
}
