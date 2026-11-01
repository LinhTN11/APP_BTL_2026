import { spawnSync } from "node:child_process";
import { adbPath, devices, environment, spawnNpm } from "./common.mjs";
const env = environment();
const connected = devices(env);
if (connected.length !== 1) {
  console.error(
    `Connect exactly one Android emulator/authorized USB device (found ${connected.length}).`
  );
  process.exit(1);
}
for (const port of [env.PORT, "8081"]) {
  const reverse = spawnSync(
    adbPath(env),
    ["-s", connected[0], "reverse", `tcp:${port}`, `tcp:${port}`],
    { env, stdio: "inherit", windowsHide: true }
  );
  if (reverse.status !== 0) process.exit(reverse.status || 1);
}
const child = spawnNpm(
  [
    "run",
    "android",
    "--workspace",
    "@gap/mobile",
    "--",
    "--no-packager",
    "--active-arch-only",
  ],
  { env }
);
child.once("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.once("exit", (code) => {
  process.exitCode = code ?? 1;
});
