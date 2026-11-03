#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, openSync, closeSync, readFileSync, renameSync, rmSync, writeFileSync, fsyncSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { environment, root as projectRoot } from "./common.mjs";

const VERSION = 1;
const RUNTIME_KEYS = [
  "DATABASE_MODE", "FIREBASE_PROJECT_ID", "FIREBASE_API_KEY", "FIREBASE_APP_ID",
  "FIREBASE_AUTH_DOMAIN", "FIRESTORE_NAMESPACE", "GOOGLE_WEB_CLIENT_ID",
  "DEMO_MODE", "FIRESTORE_SEED_DEMO", "PORT", "HOST",
];
const SECRET_ACCOUNT_KEYS = new Set([
  "type", "project_id", "private_key_id", "private_key", "client_email", "client_id",
  "auth_uri", "token_uri", "auth_provider_x509_cert_url", "client_x509_cert_url",
  "universe_domain", "quota_project_id",
]);
const BUNDLE_RELATIVE = join("secrets", "team-config.json");
const ACCOUNT_RELATIVE = join("secrets", "team-firebase-service-account.json");
const BACKUP_DIR = join("secrets", "team-setup-backups");
const PORTABLE_HOST = "0.0.0.0";
const PORTABLE_PORT = "3000";
const CLOUD_MANIFEST = "team-cloud.json";

function cleanString(value, label, { required = true, max = 512 } = {}) {
  if (typeof value !== "string") throw new Error(`Invalid ${label}.`);
  const cleaned = value.trim();
  if (/[\r\n\0]/.test(value) || value.length > max || (required && !cleaned))
    throw new Error(`Invalid ${label}.`);
  return cleaned;
}

function validateProjectId(value) {
  const projectId = cleanString(value, "Firebase project ID", { max: 128 });
  if (!/^[a-z][a-z0-9-]{4,62}[a-z0-9]$/.test(projectId)) throw new Error("Invalid Firebase project ID.");
  return projectId;
}

function validateNamespace(value) {
  const namespace = cleanString(value, "Firestore namespace", { max: 48 });
  if (!/^[a-z0-9-]{1,48}$/.test(namespace)) throw new Error("Invalid Firestore namespace.");
  return namespace;
}

function validateAccount(account, projectId) {
  if (!account || typeof account !== "object" || Array.isArray(account))
    throw new Error("Invalid service-account JSON.");
  if (Object.keys(account).some((key) => !SECRET_ACCOUNT_KEYS.has(key)))
    throw new Error("Service-account JSON contains unsupported fields.");
  if (account.type !== "service_account" || account.project_id !== projectId ||
      typeof account.private_key !== "string" || !/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(account.private_key) ||
      typeof account.client_email !== "string" || !account.client_email.includes("@"))
    throw new Error("Service-account JSON does not match the configured cloud project.");
  for (const key of SECRET_ACCOUNT_KEYS) {
    if (key === "private_key" || account[key] === undefined) continue;
    if (typeof account[key] !== "string" || /[\0\r\n]/.test(account[key]))
      throw new Error("Invalid service-account JSON.");
  }
  return account;
}

function validateConfig(config, account) {
  if (!config || typeof config !== "object" || Array.isArray(config))
    throw new Error("Invalid shared runtime configuration.");
  if (Object.keys(config).some((key) => !RUNTIME_KEYS.includes(key)))
    throw new Error("Shared configuration contains unsupported fields.");
  const normalized = {};
  for (const key of RUNTIME_KEYS) normalized[key] = cleanString(config[key], key, { max: 512 });
  normalized.FIREBASE_PROJECT_ID = validateProjectId(normalized.FIREBASE_PROJECT_ID);
  normalized.FIRESTORE_NAMESPACE = validateNamespace(normalized.FIRESTORE_NAMESPACE);
  if (normalized.DATABASE_MODE !== "firestore") throw new Error("Shared config must use Cloud Firestore.");
  if (normalized.DEMO_MODE !== "false" || normalized.FIRESTORE_SEED_DEMO !== "false")
    throw new Error("Shared config cannot enable demo or seed mode.");
  const port = Number(normalized.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid API port.");
  if (!/^[A-Za-z0-9._:-]+$/.test(normalized.HOST)) throw new Error("Invalid API host.");
  for (const key of ["FIREBASE_API_KEY", "FIREBASE_APP_ID", "FIREBASE_AUTH_DOMAIN", "GOOGLE_WEB_CLIENT_ID"])
    if (!/^[A-Za-z0-9._:-]+$/.test(normalized[key])) throw new Error(`Invalid ${key}.`);
  validateAccount(account, normalized.FIREBASE_PROJECT_ID);
  return normalized;
}

export function validateCloudManifest(root, projectId, namespace) {
  const file = join(root, CLOUD_MANIFEST);
  let manifest;
  try { manifest = JSON.parse(readFileSync(file, "utf8")); }
  catch { throw new Error("Required team-cloud.json manifest is missing or invalid; no files were changed."); }
  if (!manifest || manifest.version !== 1 ||
      Object.keys(manifest).some((key) => !["version", "projectId", "namespace"].includes(key)))
    throw new Error("Required team-cloud.json manifest is missing or invalid; no files were changed.");
  const expectedProject = validateProjectId(manifest.projectId);
  const expectedNamespace = validateNamespace(manifest.namespace);
  if (projectId !== expectedProject || namespace !== expectedNamespace)
    throw new Error("Bundle project or namespace differs from team-cloud.json; no files were changed.");
  return { projectId: expectedProject, namespace: expectedNamespace };
}

export function createBundle(env, serviceAccountText) {
  if (env.FIRESTORE_EMULATOR_HOST || env.FIREBASE_AUTH_EMULATOR_HOST)
    throw new Error("Emulator environment flags are not allowed in a cloud setup bundle.");
  const projectId = validateProjectId(env.FIREBASE_PROJECT_ID);
  const config = {
    DATABASE_MODE: cleanString(env.DATABASE_MODE ?? "firestore", "DATABASE_MODE"),
    FIREBASE_PROJECT_ID: projectId,
    FIREBASE_API_KEY: cleanString(env.FIREBASE_API_KEY, "FIREBASE_API_KEY"),
    FIREBASE_APP_ID: cleanString(env.FIREBASE_APP_ID, "FIREBASE_APP_ID"),
    FIREBASE_AUTH_DOMAIN: cleanString(env.FIREBASE_AUTH_DOMAIN, "FIREBASE_AUTH_DOMAIN"),
    FIRESTORE_NAMESPACE: validateNamespace(env.FIRESTORE_NAMESPACE),
    GOOGLE_WEB_CLIENT_ID: cleanString(env.GOOGLE_WEB_CLIENT_ID, "GOOGLE_WEB_CLIENT_ID"),
    DEMO_MODE: cleanString(env.DEMO_MODE ?? "false", "DEMO_MODE"),
    FIRESTORE_SEED_DEMO: cleanString(env.FIRESTORE_SEED_DEMO ?? "false", "FIRESTORE_SEED_DEMO"),
    PORT: PORTABLE_PORT,
    HOST: PORTABLE_HOST,
  };
  let account;
  try { account = JSON.parse(serviceAccountText); }
  catch { throw new Error("Configured service-account file is not valid JSON."); }
  validateConfig(config, account);
  return { version: VERSION, config, serviceAccount: account };
}

export function parseBundle(text) {
  let bundle;
  try { bundle = JSON.parse(text); }
  catch { throw new Error("Bundle is not valid JSON."); }
  if (!bundle || bundle.version !== VERSION || Object.keys(bundle).some((key) => !["version", "config", "serviceAccount"].includes(key)))
    throw new Error("Unsupported team setup bundle.");
  const config = validateConfig(bundle.config, bundle.serviceAccount);
  return { version: VERSION, config, serviceAccount: bundle.serviceAccount };
}

function parseEnv(text) {
  const values = new Map();
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match) {
      const list = values.get(match[1]) ?? [];
      list.push(match[2].trim().replace(/^['"]|['"]$/g, ""));
      values.set(match[1], list);
    }
  }
  return values;
}

function isGeneratedTemplate(text, templateText) {
  return !!templateText && text.replaceAll("\r\n", "\n") === templateText.replaceAll("\r\n", "\n");
}

function validateExistingConfig(text, templateText, config) {
  const current = parseEnv(text);
  const generated = isGeneratedTemplate(text, templateText);
  const values = (key) => current.get(key) ?? [];
  if (values("DATABASE_MODE").some((value) => value && value !== "firestore"))
    throw new Error("Existing local config selects a non-cloud database; resolve it before importing.");
  if (values("DEMO_MODE").some((value) => value && value !== "false") ||
      values("FIRESTORE_SEED_DEMO").some((value) => value && value !== "false") ||
      values("FIRESTORE_EMULATOR_HOST").some(Boolean) || values("FIREBASE_AUTH_EMULATOR_HOST").some(Boolean))
    throw new Error("Existing local config has demo or emulator flags; resolve them before importing.");
  const currentProjects = values("FIREBASE_PROJECT_ID").filter(Boolean);
  if (currentProjects.some((value) => value !== config.FIREBASE_PROJECT_ID) && !generated)
    throw new Error("Existing local project ID differs from the bundle; no files were changed.");
  const currentNamespaces = values("FIRESTORE_NAMESPACE").filter(Boolean);
  if (currentNamespaces.some((value) => value !== config.FIRESTORE_NAMESPACE) && !generated)
    throw new Error("Existing local Firestore namespace differs from the bundle; no files were changed.");
}

function validateRuntimeOverrides(env, config, root) {
  if (!env || typeof env !== "object") return;
  for (const key of ["FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST"])
    if (typeof env[key] === "string" && env[key].trim())
      throw new Error(`Shell override ${key} is set; unset it before installing the cloud bundle.`);
  for (const key of ["DATABASE_MODE", "FIREBASE_PROJECT_ID", "FIRESTORE_NAMESPACE", "FIREBASE_API_KEY", "FIREBASE_APP_ID", "FIREBASE_AUTH_DOMAIN", "GOOGLE_WEB_CLIENT_ID"])
    if (typeof env[key] === "string" && env[key].trim() && env[key].trim() !== config[key])
      throw new Error(`Shell override ${key} differs from the bundle; unset it before installing.`);
  for (const key of ["DEMO_MODE", "FIRESTORE_SEED_DEMO"])
    if (typeof env[key] === "string" && env[key].trim() && env[key].trim() !== "false")
      throw new Error(`Shell override ${key} enables demo/seed mode; unset it before installing.`);
  if (typeof env.GOOGLE_APPLICATION_CREDENTIALS === "string" && env.GOOGLE_APPLICATION_CREDENTIALS.trim()) {
    const active = resolve(process.cwd(), env.GOOGLE_APPLICATION_CREDENTIALS.trim());
    const expected = resolve(root, ACCOUNT_RELATIVE);
    const [normalizedActive, normalizedExpected] = process.platform === "win32"
      ? [active.toLowerCase(), expected.toLowerCase()]
      : [active, expected];
    if (normalizedActive !== normalizedExpected)
      throw new Error("Shell override GOOGLE_APPLICATION_CREDENTIALS points elsewhere; unset it before installing.");
  }
}

function mergeEnv(text, config, root) {
  const managed = new Set([...RUNTIME_KEYS, "GOOGLE_APPLICATION_CREDENTIALS"]);
  const values = { ...config, GOOGLE_APPLICATION_CREDENTIALS: resolve(root, ACCOUNT_RELATIVE).replaceAll("\\", "/") };
  const found = new Set();
  const lines = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!match || !managed.has(match[1])) {
      lines.push(line);
    } else if (!found.has(match[1])) {
      lines.push(`${match[1]}=${values[match[1]]}`);
      found.add(match[1]);
    }
  }
  for (const key of [...RUNTIME_KEYS, "GOOGLE_APPLICATION_CREDENTIALS"])
    if (!found.has(key)) lines.push(`${key}=${values[key]}`);
  return `${lines.join("\n").replace(/\n+$/, "")}\n`;
}

function atomicWrite(file, contents, mode = 0o600) {
  mkdirSync(dirname(file), { recursive: true });
  const temp = `${file}.tmp-${randomUUID()}`;
  let fd;
  try {
    fd = openSync(temp, "wx", mode);
    writeFileSync(fd, contents);
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    renameSync(temp, file);
  } catch (error) {
    if (fd !== undefined) closeSync(fd);
    rmSync(temp, { force: true });
    throw error;
  }
}

function backupExisting(root, relative, backupRoot, suffix) {
  const file = join(root, relative);
  if (!existsSync(file)) return null;
  mkdirSync(backupRoot, { recursive: true });
  const backup = join(backupRoot, `${relative.replaceAll(/[\\/]/g, "_")}.${suffix}.bak`);
  copyFileSync(file, backup, 1); // COPYFILE_EXCL
  return backup;
}

function rollbackFile(file, previous) {
  if (previous === null) rmSync(file, { force: true });
  else atomicWrite(file, previous);
}

export function importBundle({ root, bundleText, templateText = "", atomicWriteImpl = atomicWrite, runtimeEnv = {} }) {
  const bundle = parseBundle(bundleText);
  validateCloudManifest(root, bundle.config.FIREBASE_PROJECT_ID, bundle.config.FIRESTORE_NAMESPACE);
  validateRuntimeOverrides(runtimeEnv, bundle.config, root);
  const envPath = join(root, ".env.local");
  const accountPath = join(root, ACCOUNT_RELATIVE);
  const templatePath = join(root, ".env.example");
  const existingEnv = existsSync(envPath) ? readFileSync(envPath, "utf8") : templateText || (existsSync(templatePath) ? readFileSync(templatePath, "utf8") : "");
  const knownTemplate = templateText || (existsSync(templatePath) ? readFileSync(templatePath, "utf8") : "");
  validateExistingConfig(existingEnv, knownTemplate, bundle.config);
  const nextEnv = mergeEnv(existingEnv, bundle.config, root);
  const nextAccount = `${JSON.stringify(bundle.serviceAccount, null, 2)}\n`;
  const oldEnv = existsSync(envPath) ? readFileSync(envPath) : null;
  const oldAccount = existsSync(accountPath) ? readFileSync(accountPath) : null;
  if (oldEnv?.toString("utf8") === nextEnv && oldAccount?.toString("utf8") === nextAccount)
    return { changed: false, configPath: envPath, credentialPath: accountPath };

  const backupRoot = join(root, BACKUP_DIR);
  const suffix = `${Date.now()}-${randomUUID()}`;
  backupExisting(root, ".env.local", backupRoot, suffix);
  backupExisting(root, ACCOUNT_RELATIVE, backupRoot, suffix);
  let envWritten = false;
  let accountWritten = false;
  try {
    atomicWriteImpl(accountPath, nextAccount, 0o600);
    accountWritten = true;
    atomicWriteImpl(envPath, nextEnv, 0o600);
    envWritten = true;
  } catch (error) {
    try {
      if (accountWritten) rollbackFile(accountPath, oldAccount);
      if (envWritten) rollbackFile(envPath, oldEnv);
    } catch {
      throw new Error("Import failed and rollback needs manual review. Backup copies were preserved under secrets/team-setup-backups/.");
    }
    throw new Error("Import failed before configuration completed; prior files were restored where needed.");
  }
  return { changed: true, configPath: envPath, credentialPath: accountPath };
}

export function exportBundle({ root, env, credentialText }) {
  validateCloudManifest(root, env.FIREBASE_PROJECT_ID, env.FIRESTORE_NAMESPACE);
  const bundle = createBundle(env, credentialText);
  const text = `${JSON.stringify(bundle, null, 2)}\n`;
  const canonical = join(root, BUNDLE_RELATIVE);
  if (existsSync(canonical)) {
    const existing = readFileSync(canonical, "utf8");
    if (existing === text) return { path: canonical, changed: false };
    backupExisting(root, BUNDLE_RELATIVE, join(root, BACKUP_DIR), `${Date.now()}-${randomUUID()}`);
  }
  atomicWrite(canonical, text);
  return { path: canonical, changed: true };
}

export function parseArgs(args) {
  if (args.length === 1 && args[0] === "export") return { mode: "export" };
  if (args.length === 1 && args[0] === "import")
    return { mode: "import", file: BUNDLE_RELATIVE, defaultFile: true };
  if (args[0] === "import" && args.length === 3 && args[1] === "--file" && args[2])
    return { mode: "import", file: args[2], defaultFile: false };
  throw new Error("Usage: node scripts/team-config.mjs export | import [--file <bundle-path>]");
}

export async function main(args = process.argv.slice(2), deps = {}) {
  const root = deps.root ?? projectRoot;
  const io = deps.io ?? console;
  try {
    const options = parseArgs(args);
    if (options.mode === "export") {
      const env = deps.env ?? environment();
      validateCloudManifest(root, env.FIREBASE_PROJECT_ID, env.FIRESTORE_NAMESPACE);
      if (typeof env.GOOGLE_APPLICATION_CREDENTIALS !== "string" || !env.GOOGLE_APPLICATION_CREDENTIALS.trim())
        throw new Error("ADC-only config cannot be exported. Point GOOGLE_APPLICATION_CREDENTIALS to an approved local service-account file; no IAM request was made.");
      const credentialPath = cleanString(env.GOOGLE_APPLICATION_CREDENTIALS, "GOOGLE_APPLICATION_CREDENTIALS");
      let credentialText;
      try { credentialText = readFileSync(isAbsolute(credentialPath) ? credentialPath : resolve(root, credentialPath), "utf8"); }
      catch { throw new Error("Cannot export ADC-only config or read the configured service-account file. No cloud or IAM request was made."); }
      const result = exportBundle({ root, env, credentialText });
      io.log(`${result.changed ? "Bundle ready" : "Bundle already current"}: ${result.path}`);
      io.log("Share this file only through the team's approved private channel. Do not paste its contents into chat or Git.");
      return 0;
    }
    const input = isAbsolute(options.file) ? options.file : resolve(root, options.file);
    let bundleText;
    try { bundleText = readFileSync(input, "utf8"); }
    catch {
      if (options.defaultFile)
        throw new Error("Team bundle not found. Download it from Zalo and place it at PROJECT_ROOT/secrets/team-config.json, then rerun npm run team:setup.");
      throw new Error("Cannot read the selected team setup bundle.");
    }
    const result = importBundle({ root, bundleText, runtimeEnv: deps.runtimeEnv ?? process.env });
    io.log(`${result.changed ? "Local team config installed" : "Local team config already current"}.`);
    io.log("Backend credentials are stored only under secrets/; never copy them into the mobile app or commit them.");
    return 0;
  } catch (error) {
    io.error(`Team setup failed: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode = await main();
