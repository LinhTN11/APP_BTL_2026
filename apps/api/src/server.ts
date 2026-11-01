import { createApp } from "./app.js";
const app = await createApp({ logger: true });
await app.listen({ host: "0.0.0.0", port: Number(process.env.PORT ?? 3000) });
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });
