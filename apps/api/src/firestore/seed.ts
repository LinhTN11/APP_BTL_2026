import { writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { FirestoreContext } from "./context.js";
import { defaultPreferences } from "./auth.js";

export const demoIds: Record<string, string> = Object.fromEntries(
  ["A", "B", "C", "D"].map((a, i) => [
    a,
    `00000000-0000-4000-8000-00000000000${i + 1}`,
  ])
);
// Original geometric fictional avatars. No network, real person or external image provider.
function png(color: number[]) {
  const crc = (data: Buffer) => {
    let n = 0xffffffff;
    for (const b of data) {
      n ^= b;
      for (let k = 0; k < 8; k++) n = (n >>> 1) ^ (n & 1 ? 0xedb88320 : 0);
    }
    return (n ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const t = Buffer.from(type),
      out = Buffer.alloc(data.length + 12);
    out.writeUInt32BE(data.length);
    t.copy(out, 4);
    data.copy(out, 8);
    out.writeUInt32BE(crc(Buffer.concat([t, data])), data.length + 8);
    return out;
  };
  const width = 128,
    height = 160,
    raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const head = (x - 64) ** 2 + (y - 53) ** 2 < 26 ** 2,
        body = ((x - 64) / 47) ** 2 + ((y - 136) / 51) ** 2 < 1,
        pos = y * (width * 3 + 1) + 1 + x * 3;
      for (let c = 0; c < 3; c++) raw[pos + c] = head || body ? color[c] : 240;
    }
  const hdr = Buffer.alloc(13);
  hdr.writeUInt32BE(width);
  hdr.writeUInt32BE(height, 4);
  hdr[8] = 8;
  hdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", hdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
export async function seedFirestoreDemo(ctx: FirestoreContext) {
  if (!ctx.config.demoMode)
    throw new Error(
      "Demo seeding requires demoMode:true explicitly; it never enables demo login for cloud automatically."
    );
  for (const [i, account] of ["A", "B", "C", "D"].entries()) {
    const id = demoIds[account],
      mediaId = `10000000-0000-4000-8000-00000000000${i + 1}`,
      storageKey = `seed-${account}.png`;
    await ctx.db.runTransaction(async (tx) => {
      const marker = ctx.ref("seedMarkers", `core-${account}`),
        u = ctx.ref("users", id),
        p = ctx.ref("profiles", id),
        m = ctx.ref("media", mediaId),
        preferences = ctx.ref("preferences", id),
        demo = ctx.ref("demoAccounts", account);
      const [mark, user, profile, media, prefs, mapping] = await tx.getAll(
        marker,
        u,
        p,
        m,
        preferences,
        demo
      );
      if (mark.exists) return;
      // Existing state is never overwritten or repaired implicitly, even on the first seed invocation.
      if (
        !user.exists &&
        !profile.exists &&
        !media.exists &&
        !prefs.exists &&
        !mapping.exists
      ) {
        tx.create(u, {
          id,
          demoAccount: account,
          accountStatus: "active",
          createdAt: ctx.date(),
        });
        tx.create(p, {
          userId: id,
          displayName: `Bạn ${account} (hư cấu)`,
          dateOfBirth: "2000-05-15",
          gender: i % 2 ? "male" : "female",
          bio: "Hồ sơ demo hư cấu. Thích cà phê và đi dạo.",
          datingGoal: "relationship",
          interests: ["coffee", "music"],
          lifestyle: {},
          advanced: {},
          mediaIds: [mediaId],
          visibility: "public",
        });
        tx.create(m, {
          userId: id,
          storageKey,
          kind: "image",
          mime: "image/png",
          position: 0,
          scope: "profile",
          createdAt: ctx.date(),
        });
        tx.create(preferences, defaultPreferences());
        tx.create(demo, { userId: id });
      }
      tx.create(marker, { createdAt: ctx.date() });
    });
    const media = (await ctx.ref("media", mediaId).get()).data();
    if (media?.storageKey === storageKey) {
      const path = join(ctx.config.dataDir, "media", storageKey);
      try {
        await stat(path);
      } catch {
        await writeFile(
          path,
          png(
            [
              [121, 93, 175],
              [206, 120, 105],
              [70, 146, 148],
              [194, 158, 80],
            ][i]
          ),
          { flag: "wx" }
        ).catch(async (error) => {
          if (error.code !== "EEXIST") throw error;
        });
      }
    }
  }
}
