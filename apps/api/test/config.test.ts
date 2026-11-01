import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setupDatabase } from "../src/db/database.js";

test("non-demo database setup creates the media directory without seeding users", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "gap-api-config-"));
  const dbPath = join(dataDir, "data.sqlite");
  let db: ReturnType<typeof setupDatabase> | undefined;
  try {
    db = setupDatabase({ dbPath, dataDir, demoMode: false });

    assert.deepEqual(await readdir(join(dataDir, "media")), []);
    assert.equal(
      (db.prepare("SELECT count(*) AS count FROM users").get() as { count: number })
        .count,
      0
    );
  } finally {
    db?.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});
