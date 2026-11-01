import { existsSync, copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { root, environment } from "./common.mjs";

if (Number(process.versions.node.split(".")[0]) !== 24) {
  console.error("Use Node 24.15.0 (see .node-version).");
  process.exit(1);
}
if (!existsSync(join(root, ".env.local")))
  copyFileSync(join(root, ".env.example"), join(root, ".env.local"));
mkdirSync(join(root, "data"), { recursive: true });
const env = environment();
const android = join(root, "apps", "mobile", "android");
if (
  existsSync(android) &&
  env.ANDROID_HOME &&
  !existsSync(join(android, "local.properties"))
) {
  writeFileSync(
    join(android, "local.properties"),
    `sdk.dir=${env.ANDROID_HOME.replaceAll("\\", "/")}\n`
  );
}
console.log(
  "Local configuration ready; existing config/data preserved. Cloud Firestore requires project/credentials; seed only through an explicit command."
);
