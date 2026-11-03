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

const apiOnly = process.argv.includes("--api-only");
const mobileOnly = process.argv.includes("--mobile-only");
if (apiOnly && mobileOnly) {
  console.error("Chọn một chế độ: BE, FE hoặc demo chung.");
  process.exit(1);
}
const startApi = !mobileOnly;
const startMobile = !apiOnly;
const setup = spawnSync(
  process.execPath,
  [join(root, "scripts", "setup.mjs")],
  { stdio: "inherit" }
);
if (setup.status !== 0) process.exit(setup.status || 1);
const env = environment();
if (startApi) {
  try {
    firestoreConfiguration(env);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
for (const port of [startApi && Number(env.PORT), startMobile && 8081].filter(Boolean)) {
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
if (startApi) {
  console.log(`API: http://127.0.0.1:${env.PORT} (emulator: http://10.0.2.2:${env.PORT})`);
  console.log(`Swagger: http://127.0.0.1:${env.PORT}/docs`);
  console.log(`LAN: ${lanAddresses().map((x) => `http://${x}:${env.PORT}`).join(", ")}`);
  console.log(`DB: Firestore; ${env.DATABASE_MODE}; project: ${env.FIREBASE_PROJECT_ID}; namespace: ${env.FIRESTORE_NAMESPACE}`);
}
if (startMobile) console.log("Metro: http://127.0.0.1:8081. Nhập URL API của BE trong mục Kết nối API trên màn đăng nhập.");
if (mobileOnly) console.log("FE dùng API chung: không cần Firebase config hoặc file secret.");
console.log(`Runtime: ${env.DEMO_MODE === "true" ? "explicit emulator demo" : "real data; demo providers disabled"}. Ctrl+C dừng các tiến trình do lệnh này tạo.`);
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
const commands = [];
if (startApi) commands.push(["run", "dev", "--workspace", "@gap/api"]);
if (startMobile) commands.push(["run", "dev:mobile"]);
for (const args of commands) {
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
if (startMobile && !process.argv.includes("--no-android")) {
  if (devices(env).length === 1) {
    // Wait for the API before launching the native build/install lane.
    let ready = !startApi;
    for (let attempt = 0; !ready && attempt < 60 && !stopping; attempt++) {
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
          "Android build/install failed. Metro remains available; fix toolchain and retry npm run android."
        );
    });
  } else
    console.log(
      "Mở một emulator hoặc cắm một máy USB, rồi chạy npm run android ở terminal khác."
    );
}
