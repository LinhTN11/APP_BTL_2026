#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, chmodSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
function git(args) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (cause) {
    const error = new Error(`git ${args[0]} failed; check repository state and Git availability`);
    error.status = cause.status;
    throw error;
  }
}

try {
  let existing = "";
  let origin = "";
  try {
    const configured = git(["config", "--show-origin", "--get", "core.hooksPath"]);
    const separator = configured.indexOf("\t");
    if (separator < 0) throw new Error("could not inspect effective core.hooksPath");
    origin = configured.slice(0, separator);
    existing = configured.slice(separator + 1);
  } catch (error) {
    if (error.status !== 1) throw error;
  }
  const ours = ".githooks";
  const oursAbsolute = resolve(root, ours);
  const configuredAbsolute = existing ? resolve(root, existing) : "";
  const gitHooks = resolve(root, git(["rev-parse", "--git-path", "hooks"]));
  const activeExisting = ["pre-commit", "pre-push"].filter((name) => existsSync(join(gitHooks, name)));
  if (existing && configuredAbsolute !== oursAbsolute) {
    console.error(`Secret guard hooks not installed: effective core.hooksPath is already set by ${origin} to "${existing}". Review and integrate it manually; this setting was preserved.`);
    process.exitCode = 1;
  } else if (!existing && activeExisting.length) {
    console.error(`Secret guard hooks not installed: active hook(s) already exist in ${gitHooks}: ${activeExisting.join(", ")}. Integrate the scanner manually to preserve them.`);
    process.exitCode = 1;
  } else {
    for (const name of ["pre-commit", "pre-push"]) chmodSync(join(root, ours, name), 0o755);
    if (!existing) git(["config", "--local", "core.hooksPath", ours]);
    console.log(`Secret guard hooks enabled via ${ours}.`);
  }
} catch (error) {
  console.error(`Secret guard hook installation failed: ${error.message}`);
  process.exitCode = 1;
}
