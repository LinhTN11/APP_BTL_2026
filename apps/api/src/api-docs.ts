import type { FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { join, resolve } from "node:path";

const specificationDirectory = resolve(import.meta.dirname, "../../../docs/api");

declare module "fastify" {
  interface FastifyContextConfig {
    publicDocumentation?: boolean;
  }
}

// Use the checked-in contract. Swagger assets and schema are served locally;
// neither an external CDN nor the online Swagger validator receives requests.
export async function registerApiDocs(app: FastifyInstance) {
  await app.register(async (documentation) => {
    documentation.addHook("onRoute", (route) => {
      route.config = { ...route.config, publicDocumentation: true };
    });
    await documentation.register(swagger, {
      mode: "static",
      specification: {
        path: join(specificationDirectory, "openapi.yaml"),
        baseDir: specificationDirectory,
      },
    });
    await documentation.register(swaggerUi, {
      routePrefix: "/docs",
      staticCSP: true,
      // Team development uses HTTP on loopback/LAN. Keep the remaining CSP.
      transformStaticCSP: (header) =>
        header
          .replace("upgrade-insecure-requests;", "")
          // Swagger UI injects runtime styles; scripts retain the plugin CSP.
          .replace(/style-src [^;]+;/, "style-src 'self' 'unsafe-inline';"),
      uiConfig: {
        deepLinking: true,
        filter: true,
        docExpansion: "list",
        displayRequestDuration: true,
        tryItOutEnabled: true,
        persistAuthorization: false,
        validatorUrl: null,
      },
    });
  });
}
