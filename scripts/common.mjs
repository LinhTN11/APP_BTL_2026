import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawnSync, spawn } from "node:child_process";
import { networkInterfaces } from "node:os";

export const root = dirname(dirname(fileURLToPath(import.meta.url)));
export const windows = process.platform === "win32";
export const npm = windows ? "npm.cmd" : "npm";

export function environment() {
  const env = { ...process.env };
  const path = join(root, ".env.local");
  if (existsSync(path)) {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (match && env[match[1]] === undefined)
        env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
    }
  }
  const fallbackSdk =
    env.LOCALAPPDATA && join(env.LOCALAPPDATA, "Android", "Sdk");
  env.ANDROID_HOME ||=
    env.ANDROID_SDK_ROOT ||
    (fallbackSdk && existsSync(fallbackSdk) ? fallbackSdk : "");
  const bundledJdk =
    env.ProgramFiles &&
    join(env.ProgramFiles, "Android", "Android Studio", "jbr");
  if (
    !env.JAVA_HOME &&
    bundledJdk &&
    existsSync(join(bundledJdk, "bin", "java.exe"))
  )
    env.JAVA_HOME = bundledJdk;
  env.PORT ||= "3000";
  env.HOST ||= "0.0.0.0";
  env.DEMO_MODE ||= "true";
  env.DATA_DIR ||= join(root, "data");
  return env;
}

export function adbPath(env = environment()) {
  const full =
    env.ANDROID_HOME &&
    join(env.ANDROID_HOME, "platform-tools", windows ? "adb.exe" : "adb");
  return full && existsSync(full) ? full : "adb";
}

export function devices(env = environment()) {
  const result = spawnSync(adbPath(env), ["devices"], {
    encoding: "utf8",
    env,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) return [];
  return result.stdout
    .split(/\r?\n/)
    .filter((line) => /^\S+\s+device$/.test(line.trim()))
    .map((line) => line.trim().split(/\s+/)[0]);
}

export function spawnNpm(args, options = {}) {
  const launchOptions = {
    cwd: root,
    stdio: "inherit",
    env: environment(),
    windowsHide: true,
    ...options,
  };
  if (!windows) return spawn("npm", args, launchOptions);
  // Invoke npm's JS entry point directly: no cmd.exe quoting or shell args.
  const npmCli = [
    process.env.npm_execpath,
    join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"),
  ].find((path) => path && existsSync(path));
  if (!npmCli)
    throw new Error(
      "Cannot locate npm-cli.js. Run through npm run or install Node/npm together."
    );
  return spawn(process.execPath, [npmCli, ...args], launchOptions);
}

export function lanAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter(
      (x) =>
        x &&
        x.family === "IPv4" &&
        !x.internal &&
        !x.address.startsWith("169.254.")
    )
    .map((x) => x.address);
}

export async function stopProcess(child) {
  if (!child || child.exitCode !== null) return;
  if (windows) {
    await new Promise((resolve) => {
      const killer = spawn(
        "taskkill",
        ["/pid", String(child.pid), "/T", "/F"],
        { stdio: "ignore", windowsHide: true }
      );
      killer.once("exit", resolve);
      killer.once("error", resolve);
    });
  } else {
    child.kill("SIGTERM");
  }
}
