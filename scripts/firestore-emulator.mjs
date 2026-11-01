import { spawn } from "node:child_process";
import { join } from "node:path";
import { createConnection } from "node:net";
import { root, environment, spawnNpm, stopProcess } from "./common.mjs";

const demo = process.argv.includes("--demo");
const smoke = process.argv.includes("--smoke");
const env = environment();
env.DATABASE_MODE = "firestore-emulator";
env.FIREBASE_PROJECT_ID = "demo-app-cuoi-ky";
env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8089";
env.FIRESTORE_NAMESPACE = demo ? "app-cuoi-ky-test" : "test-runner";
env.DEMO_MODE = "true";
env.FIRESTORE_SEED_DEMO = demo ? "true" : "false";
// gcp-metadata's supported test setting: local emulator needs no GCE metadata.
// Cloud/ADC launchers keep their normal metadata discovery behavior.
env.METADATA_SERVER_DETECTION = "none";
// This lane never needs or forwards a cloud administrative credential.
delete env.GOOGLE_APPLICATION_CREDENTIALS;
delete env.GOOGLE_CLOUD_PROJECT;
if (env.JAVA_HOME)
  env.PATH =
    join(env.JAVA_HOME, "bin") +
    (process.platform === "win32" ? ";" : ":") +
    env.PATH;
function available() {
  return new Promise((resolve) => {
    const s = createConnection({ host: "127.0.0.1", port: 8089 });
    s.once("connect", () => {
      s.destroy();
      resolve(true);
    });
    s.once("error", () => resolve(false));
    s.setTimeout(500, () => {
      s.destroy();
      resolve(false);
    });
  });
}
let emulator;
let work;
let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  await stopProcess(work);
  await stopProcess(emulator);
  process.exit(code);
}
process.once("SIGINT", () => void stop());
process.once("SIGTERM", () => void stop());
if (!(await available())) {
  emulator = spawn(
    process.execPath,
    [
      join(root, "node_modules/firebase-tools/lib/bin/firebase.js"),
      "emulators:start",
      "--only",
      "firestore",
      "--project",
      env.FIREBASE_PROJECT_ID,
      "--config",
      join(root, "firebase.json"),
    ],
    { cwd: root, env, stdio: "inherit", windowsHide: true }
  );
  emulator.once("error", (error) => {
    console.error(error.message);
    void stop(1);
  });
  emulator.once("exit", (code) => {
    if (!stopping) {
      console.error(`Firestore emulator exited ${code}`);
      void stop(code || 1);
    }
  });
  let ready = false;
  for (let i = 0; i < 180 && !stopping; i++) {
    if (await available()) {
      ready = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!ready) {
    console.error(
      "Firestore emulator did not start. Check Java21, port8089 and first-run download access."
    );
    await stop(1);
  }
} else
  console.log(
    "Using an already running local Firestore emulator on127.0.0.1:8089. Only demo project/temporary test namespaces are used."
  );
console.log("EXPLICIT EMULATOR LANE — not Cloud Firestore verification.");
work = demo
  ? spawnNpm(["run", "demo"], { env })
  : smoke
  ? spawn(
      process.execPath,
      ["--import", "tsx", join(root, "scripts", "smoke-demo.mjs")],
      { cwd: root, env, stdio: "inherit", windowsHide: true }
    )
  : spawnNpm(["run", "test:firestore", "--workspace", "@gap/api"], { env });
work.once("error", (error) => {
  console.error(error.message);
  void stop(1);
});
work.once("exit", (code) => void stop(code ?? 1));
