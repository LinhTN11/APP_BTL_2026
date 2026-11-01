import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { root, environment, devices, lanAddresses } from "./common.mjs";

const env = environment();
let failures = 0;
function check(ok, message) {
  console.log(`${ok ? "OK" : "CHECK"} ${message}`);
  if (!ok) failures++;
}
check(
  Number(process.versions.node.split(".")[0]) === 24,
  `Node ${process.versions.node}; target 24.15.0`
);
check(
  existsSync(join(root, "node_modules")),
  "Dependencies installed (npm ci)"
);
check(
  Boolean(env.ANDROID_HOME && existsSync(env.ANDROID_HOME)),
  `Android SDK: ${env.ANDROID_HOME || "set ANDROID_HOME"}`
);
const java = env.JAVA_HOME
  ? join(
      env.JAVA_HOME,
      "bin",
      process.platform === "win32" ? "java.exe" : "java"
    )
  : "java";
const jdk = spawnSync(java, ["-version"], {
  env,
  encoding: "utf8",
  windowsHide: true,
});
check(
  jdk.status === 0,
  `Java: ${
    (jdk.stderr || "").split(/\r?\n/)[0] || "set JAVA_HOME to a compatible JDK"
  }`
);
const connected = devices(env);
check(
  connected.length > 0,
  `Android devices: ${
    connected.join(", ") || "start an emulator or authorize a USB device"
  }`
);
for (const port of [Number(env.PORT), 8081]) {
  const available = await new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
  });
  check(
    available,
    `Port ${port} ${
      available
        ? "available"
        : "in use; stop your existing project server or change configuration"
    }`
  );
}
console.log(
  `Emulator API: http://10.0.2.2:${env.PORT}; USB after adb reverse: http://127.0.0.1:${env.PORT}`
);
console.log(
  `LAN API choices: ${
    lanAddresses()
      .map((x) => `http://${x}:${env.PORT}`)
      .join(", ") || "no LAN interface found"
  }`
);
console.log(
  "React Native Community CLI only. First Android build downloads Gradle/native dependencies; no Expo Go."
);
process.exitCode = failures ? 1 : 0;
