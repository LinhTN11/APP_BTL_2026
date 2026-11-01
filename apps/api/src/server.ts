import { createFirestoreApp } from "./firestore/app.js";
if (!["firestore", "firestore-emulator"].includes(process.env.DATABASE_MODE ?? "firestore")) {
  throw new Error("DATABASE_MODE must be firestore or explicit firestore-emulator. SQLite is no longer the primary database.");
}
const app = await createFirestoreApp({ logger: true, seedDemo: process.env.FIRESTORE_SEED_DEMO === "true" });
await app.listen({ host: process.env.HOST ?? "0.0.0.0", port: Number(process.env.PORT ?? 3000) });
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });
