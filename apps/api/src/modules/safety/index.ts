import { readFileSync } from "node:fs";
import type { FastifyInstance } from "fastify";
import { Domain } from "../../domain.js";
import { transaction } from "../../db/database.js";
import { registerKeywords } from "./keywords.js";
import { initializeContactKey, registerContacts } from "./contacts.js";
import { registerModeratedMedia } from "./media.js";
import { registerReview } from "./review.js";

export { filterMessageForViewer } from "./keywords.js";
export { isContactBlocked, recordUnmatchFeedback } from "./contacts.js";
export function registerSafety(app: FastifyInstance, d: Domain) {
  transaction(d.db, () => {
    d.db.exec(readFileSync(new URL("../../db/migrations/004_safety.sql", import.meta.url), "utf8"));
    initializeContactKey(d);
  });
  registerKeywords(app, d);
  registerContacts(app, d);
  registerModeratedMedia(app, d);
  registerReview(app, d);
}
