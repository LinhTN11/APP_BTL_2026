import { createFirestoreContext } from "../apps/api/src/firestore/context.ts";
import { environment, firestoreConfiguration } from "./common.mjs";

const command = process.argv[2] ?? "check";
if (!["check", "seed"].includes(command))
  throw new Error("Usage: firestore.mjs check|seed");
const env = environment();
firestoreConfiguration(env);
if (command === "seed" && (env.DATABASE_MODE !== "firestore-emulator" || env.DEMO_MODE !== "true" || env.NODE_ENV === "production"))
  throw new Error("Seeding is restricted to explicit emulator demo testing.");
Object.assign(process.env, env);
const ctx = await createFirestoreContext({
  projectId: env.FIREBASE_PROJECT_ID,
  namespace: env.FIRESTORE_NAMESPACE,
  emulatorHost:
    env.DATABASE_MODE === "firestore-emulator"
      ? env.FIRESTORE_EMULATOR_HOST
      : undefined,
  demoMode: env.DEMO_MODE === "true",
  dataDir: env.DATA_DIR,
});
try {
  if (command === "seed") {
    if (!ctx.config.demoMode)
      throw new Error("Demo seeding requires explicit DEMO_MODE=true.");
    const { seedFirestoreDemo } = await import("../apps/api/src/firestore/seed.ts");
    await seedFirestoreDemo(ctx);
    console.log(
      `Seed complete (create-only): ${ctx.database.mode} project=${ctx.database.projectId}, namespace=${ctx.database.namespace}. Existing profiles/swipes/messages were not reset.`
    );
  } else
    console.log(
      `Firestore read connection OK: ${ctx.database.mode} project=${ctx.database.projectId}, namespace=${ctx.database.namespace}. No documents written.`
    );
} finally {
  await ctx.close();
}
