import { spawnSync } from "node:child_process";
import { join } from "node:path";
import {
  root,
  environment,
  spawnNpm,
  stopProcess,
  devices,
  lanAddresses,
  firestoreConfiguration,
  isPortAvailable,
} from "./common.mjs";

const setup = spawnSync(
  process.execPath,
  [join(root, "scripts", "setup.mjs")],
  { stdio: "inherit" }
);
if (setup.status !== 0) process.exit(setup.status || 1);
const env = environment();
try {
  firestoreConfiguration(env);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
for (const port of [Number(env.PORT), 8081]) {
  const host =
    port === Number(env.PORT) && env.HOST !== "0.0.0.0"
      ? env.HOST
      : "127.0.0.1";
  const free = await isPortAvailable(port, host);
  if (!free) {
    console.error(
      `Port ${port} is in use. Stop that server before starting this demo.`
    );
    process.exit(1);
  }
}
console.log(
  `API: http://127.0.0.1:${env.PORT} (emulator: http://10.0.2.2:${env.PORT})`
);
console.log(
  `LAN: ${lanAddresses()
    .map((x) => `http://${x}:${env.PORT}`)
    .join(", ")}`
);
console.log(
  "DEMO auth/providers are labeled. No SMS/payment sent. Ctrl+C stops this demo process tree."
);
console.log(
  `DB provider: Firestore; mode: ${env.DATABASE_MODE}; project: ${env.FIREBASE_PROJECT_ID}; namespace: ${env.FIRESTORE_NAMESPACE}`
);
const children = [];
let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  await Promise.all(children.map(stopProcess));
  process.exit(code);
}
process.once("SIGINT", () => void stop());
process.once("SIGTERM", () => void stop());
for (const args of [
  ["run", "dev:api"],
  ["run", "dev:mobile"],
]) {
  const child = spawnNpm(args, { env });
  children.push(child);
  child.once("error", (error) => {
    console.error(error.message);
    void stop(1);
  });
  child.once("exit", (code) => {
    if (!stopping) {
      console.error(`Demo component exited (${code}).`);
      void stop(code || 1);
    }
  });
}
if (!process.argv.includes("--no-android")) {
  if (devices(env).length === 1) {
    // Wait for the API before launching the native build/install lane.
    let ready = false;
    for (let attempt = 0; attempt < 60 && !stopping; attempt++) {
      try {
        ready = (
          await fetch(`http://127.0.0.1:${env.PORT}/health`, {
            signal: AbortSignal.timeout(1000),
          })
        ).ok;
      } catch {}
      if (ready) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!ready) {
      console.error("API failed to become ready.");
      await stop(1);
    }
    const android = spawnNpm(["run", "android"], { env });
    children.push(android);
    android.once("error", (error) =>
      console.error(`Android launch: ${error.message}`)
    );
    android.once("exit", (code) => {
      if (code)
        console.error(
          "Android build/install failed. API+Metro remain available; fix toolchain and retry npm run android."
        );
    });
  } else
    console.log(
      "Start an emulator/connect one USB device, then run npm run android in another terminal. Backend and Metro are running."
    );
}
