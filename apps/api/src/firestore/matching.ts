import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { DocumentData, Transaction } from "firebase-admin/firestore";
import { FirestoreContext, fail, uid } from "./context.js";
import { object, uuid, enumString, str } from "../schemas.js";

// Both instances address exactly the same document, including before a match exists.
export function pairDocumentId(a: string, b: string) {
  const hex = createHash("sha256")
    .update([a, b].sort().join(":"))
    .digest("hex")
    .slice(0, 32)
    .split("");
  hex[12] = "5";
  hex[16] = ((parseInt(hex[16], 16) & 3) | 8).toString(16);
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(
    12,
    16
  )}-${value.slice(16, 20)}-${value.slice(20)}`;
}
export function pagination(query: any) {
  const limit = query?.limit === undefined ? 20 : Number(query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50)
    fail(400, "VALIDATION_ERROR", "limit phải từ 1 đến 50");
  let cursor: [string, string] | null = null;
  if (query?.cursor) {
    try {
      const parsed = JSON.parse(
        Buffer.from(query.cursor, "base64url").toString()
      );
      if (
        !Array.isArray(parsed) ||
        parsed.length !== 2 ||
        parsed.some((x) => typeof x !== "string") ||
        !Number.isFinite(Date.parse(parsed[0])) ||
        !/^[\da-f-]{36}$/i.test(parsed[1])
      )
        throw Error();
      cursor = parsed as [string, string];
    } catch {
      fail(400, "INVALID_CURSOR", "Cursor không hợp lệ");
    }
  }
  return { limit, cursor };
}
export const encodePageCursor = (row: DocumentData) =>
  Buffer.from(JSON.stringify([row.createdAt, row.id])).toString("base64url");
export async function requireTransactionSession(
  ctx: FirestoreContext,
  tx: Transaction,
  actor: string,
  sessionKey: string
) {
  const [sessionDoc, userDoc] = await tx.getAll(
      ctx.ref("sessions", sessionKey),
      ctx.ref("users", actor)
    ),
    session = sessionDoc.data();
  if (
    !session ||
    session.userId !== actor ||
    session.revokedAt !== null ||
    session.expiresAt <= ctx.config.now() ||
    userDoc.data()?.accountStatus !== "active"
  )
    fail(401, "SESSION_EXPIRED", "Phiên đăng nhập không còn hiệu lực");
}
export function assertMatchMember(
  match: DocumentData | undefined,
  actor: string
): asserts match is DocumentData {
  if (!match || !match.memberIds.includes(actor))
    fail(404, "NOT_FOUND", "Không tìm thấy kết nối");
}
export async function requireActiveFirestoreMatch(
  ctx: FirestoreContext,
  actor: string,
  id: string,
  transaction?: Transaction
) {
  const read = async (collection: string, key: string) =>
    (transaction
      ? await transaction.get(ctx.ref(collection, key))
      : await ctx.ref(collection, key).get()
    ).data();
  const match = await read("matches", id);
  assertMatchMember(match, actor);
  const [a, b] = match.memberIds as string[];
  const refs = [
    ctx.ref("blocks", `${a}_${b}`),
    ctx.ref("blocks", `${b}_${a}`),
    ctx.ref("users", a),
    ctx.ref("users", b),
  ];
  const docs = transaction
    ? await transaction.getAll(...refs)
    : await ctx.db.getAll(...refs);
  if (
    match.status !== "active" ||
    docs[0].exists ||
    docs[1].exists ||
    docs.slice(2).some((x) => x.data()?.accountStatus !== "active")
  )
    fail(403, "MATCH_INACTIVE", "Kết nối đã kết thúc");
  return match;
}
export async function firestoreMatchDto(
  ctx: FirestoreContext,
  match: DocumentData,
  actor: string
) {
  return {
    id: match.id,
    otherUser: await ctx.user(
      match.memberIds.find((id: string) => id !== actor)
    ),
    status: match.status,
    createdAt: match.createdAt,
  };
}
export function endFirestoreMatchRooms(
  ctx: FirestoreContext,
  matchId: string,
  reason: "blocked" | "unmatched"
) {
  ctx.io.to(`match:${matchId}`).emit("match:ended", { matchId, reason });
  ctx.io.in(`match:${matchId}`).socketsLeave(`match:${matchId}`);
}
const complete = (ctx: FirestoreContext, profile: DocumentData | undefined) =>
  !!profile &&
  ctx.age(profile.dateOfBirth ?? "") >= 18 &&
  !!profile.displayName?.trim() &&
  !!profile.bio?.trim() &&
  profile.mediaIds?.length > 0;
const kilometres = (a: DocumentData, b: DocumentData) => {
  const r = Math.PI / 180,
    x =
      Math.sin(((b.latitude - a.latitude) * r) / 2) ** 2 +
      Math.cos(a.latitude * r) *
        Math.cos(b.latitude * r) *
        Math.sin(((b.longitude - a.longitude) * r) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(x)));
};

export function registerFirestoreMatching(
  app: FastifyInstance,
  ctx: FirestoreContext
) {
  app.get("/v1/discovery", async (req) => {
    const { limit, cursor } = pagination(req.query);
    const [preferenceDoc, locationDoc] = await ctx.db.getAll(
      ctx.ref("preferences", req.actor),
      ctx.ref("locations", req.actor)
    );
    const preferences = preferenceDoc.data() ?? {
      genders: ["male", "female", "other"],
      minAge: 18,
      maxAge: 100,
      radiusKm: 100,
      advancedFilters: {},
    };
    const ownLocation = locationDoc.data(),
      data = [];
    let after = cursor,
      scanned = 0,
      exhausted = false;
    // Bounded scan windows avoid loading an entire cloud collection when filters exclude most candidates.
    while (data.length < limit && scanned < 200 && !exhausted) {
      let query = ctx
        .collection("users")
        .where("accountStatus", "==", "active")
        .orderBy("createdAt")
        .orderBy("id")
        .limit(Math.min(50, 200 - scanned));
      if (after) query = query.startAfter(...after);
      const snapshot = await query.get();
      if (snapshot.empty) {
        exhausted = true;
        break;
      }
      let consumed = 0;
      for (const userDoc of snapshot.docs) {
        const user = userDoc.data(),
          target = userDoc.id;
        consumed++;
        scanned++;
        after = [user.createdAt, user.id];
        if (target === req.actor) continue;
        const docs = await ctx.db.getAll(
          ctx.ref("profiles", target),
          ctx.ref("blocks", `${req.actor}_${target}`),
          ctx.ref("blocks", `${target}_${req.actor}`),
          ctx.ref("swipes", `${req.actor}_${target}`),
          ctx.ref("matches", pairDocumentId(req.actor, target)),
          ctx.ref("locations", target)
        );
        const profile = docs[0].data();
        if (
          !complete(ctx, profile) ||
          profile!.visibility !== "public" ||
          docs.slice(1, 5).some((document) => document.exists)
        )
          continue;
        const age = ctx.age(profile!.dateOfBirth);
        if (
          !preferences.genders.includes(profile!.gender) ||
          age < preferences.minAge ||
          age > preferences.maxAge
        )
          continue;
        const filters = preferences.advancedFilters ?? {},
          advanced = profile!.advanced ?? {};
        if (
          filters.datingGoal != null &&
          profile!.datingGoal !== filters.datingGoal
        )
          continue;
        if (
          ["children", "education", "religion", "hometown"].some(
            (key) =>
              filters[key] != null &&
              String(advanced[key] ?? "")
                .normalize("NFKC")
                .trim()
                .toLowerCase() !==
                String(filters[key]).normalize("NFKC").trim().toLowerCase()
          )
        )
          continue;
        if (
          filters.minHeightCm != null &&
          (advanced.heightCm == null || advanced.heightCm < filters.minHeightCm)
        )
          continue;
        if (
          filters.maxHeightCm != null &&
          (advanced.heightCm == null || advanced.heightCm > filters.maxHeightCm)
        )
          continue;
        const location = docs[5].data();
        if (
          ownLocation?.consent &&
          location?.consent &&
          kilometres(ownLocation, location) > preferences.radiusKm
        )
          continue;
        // Recheck block visibility before returning the public profile DTO.
        if (await ctx.blocked(req.actor, target)) continue;
        data.push(await ctx.profile(target));
        if (data.length === limit) break;
      }
      exhausted =
        consumed === snapshot.size &&
        snapshot.size < Math.min(50, 200 - scanned + consumed);
    }
    return {
      data,
      meta: {
        nextCursor:
          !exhausted && after
            ? Buffer.from(JSON.stringify(after)).toString("base64url")
            : null,
        radiusAvailable: !!ownLocation?.consent,
        reason: ownLocation?.consent
          ? "Chỉ lọc bán kính với hồ sơ có vị trí được đồng ý"
          : "Chưa có quyền vị trí; bán kính chưa áp dụng, không giả khoảng cách",
      },
    };
  });
  app.post(
    "/v1/swipes",
    {
      schema: {
        body: object(
          {
            targetUserId: uuid,
            action: enumString(["like", "pass"]),
            gateAnswer: str(100),
          },
          ["targetUserId", "action"]
        ),
      },
    },
    async (req) => {
      const { targetUserId, action } = req.body as any,
        actor = req.actor;
      if (actor === targetUserId)
        fail(422, "SELF_ACTION", "Không thể chọn chính mình");
      const id = pairDocumentId(actor, targetUserId),
        swipeRef = ctx.ref("swipes", `${actor}_${targetUserId}`);
      const result = await ctx.db.runTransaction(async (tx) => {
        const refs = [
          ctx.ref("users", actor),
          ctx.ref("users", targetUserId),
          ctx.ref("profiles", actor),
          ctx.ref("profiles", targetUserId),
          ctx.ref("blocks", `${actor}_${targetUserId}`),
          ctx.ref("blocks", `${targetUserId}_${actor}`),
          ctx.ref("matches", id),
          swipeRef,
          ctx.ref("swipes", `${targetUserId}_${actor}`),
        ];
        const docs = await tx.getAll(...refs),
          [
            ownUser,
            target,
            ownProfile,
            targetProfile,
            block,
            reverseBlock,
            match,
            swipe,
            reverseSwipe,
          ] = docs.map((x) => x.data());
        await requireTransactionSession(ctx, tx, actor, req.sessionId);
        if (!target || target.accountStatus !== "active")
          fail(404, "NOT_FOUND", "Không tìm thấy hồ sơ");
        if (
          ownUser?.accountStatus !== "active" ||
          block ||
          reverseBlock ||
          !complete(ctx, ownProfile) ||
          !complete(ctx, targetProfile)
        )
          fail(
            422,
            "PROFILE_UNAVAILABLE",
            "Hồ sơ chưa đầy đủ hoặc không khả dụng"
          );
        if (match?.status === "ended")
          fail(409, "MATCH_ENDED", "Kết nối đã kết thúc; không tự match lại");
        if (swipe && swipe.action !== action)
          fail(409, "SWIPE_CONFLICT", "Đã chọn hồ sơ này");
        const savedSwipe = swipe ?? {
          id: uid(),
          actorId: actor,
          targetUserId,
          action,
          createdAt: ctx.date(),
        };
        let savedMatch = match;
        if (!swipe) tx.create(swipeRef, savedSwipe);
        if (!match && action === "like" && reverseSwipe?.action === "like") {
          savedMatch = {
            id,
            memberIds: [actor, targetUserId].sort(),
            status: "active",
            createdAt: ctx.date(),
            endedAt: null,
            lastMessageAt: null,
          };
          tx.create(ctx.ref("matches", id), savedMatch);
        }
        return { swipeId: savedSwipe.id, match: savedMatch };
      });
      return {
        data: {
          swipeId: result.swipeId,
          match: result.match
            ? await firestoreMatchDto(ctx, result.match, actor)
            : null,
        },
      };
    }
  );
  app.get("/v1/matches", async (req) => {
    const { limit, cursor } = pagination(req.query);
    let query = ctx
      .collection("matches")
      .where("memberIds", "array-contains", req.actor)
      .where("status", "==", "active")
      .orderBy("createdAt")
      .orderBy("id")
      .limit(limit + 1);
    if (cursor) query = query.startAfter(...cursor);
    const snapshot = await query.get(),
      page = snapshot.docs.slice(0, limit);
    const data = [];
    for (const document of page) {
      try {
        const match = await requireActiveFirestoreMatch(
          ctx,
          req.actor,
          document.id
        );
        data.push(await firestoreMatchDto(ctx, match, req.actor));
      } catch (error: any) {
        if (error.code !== "MATCH_INACTIVE") throw error;
      }
    }
    return {
      data,
      meta: {
        nextCursor:
          snapshot.size > limit && page.length
            ? encodePageCursor(page.at(-1)!.data())
            : null,
      },
    };
  });
  app.delete<{ Params: { id: string } }>("/v1/matches/:id", async (req) => {
    const body = req.body as any;
    if (
      body !== undefined &&
      (!body ||
        typeof body !== "object" ||
        Array.isArray(body) ||
        Object.keys(body).some((k) => k !== "reasonCode") ||
        (body.reasonCode !== undefined &&
          (typeof body.reasonCode !== "string" || body.reasonCode.length > 80)))
    )
      fail(400, "VALIDATION_ERROR", "reasonCode không hợp lệ");
    const ended = await ctx.db.runTransaction(async (tx) => {
      const match = (await tx.get(ctx.ref("matches", req.params.id))).data();
      await requireTransactionSession(ctx, tx, req.actor, req.sessionId);
      assertMatchMember(match, req.actor);
      if (match.status !== "active") return false;
      tx.update(ctx.ref("matches", req.params.id), {
        status: "ended",
        endedAt: ctx.date(),
        endedReason: "unmatched",
      });
      if (body?.reasonCode)
        tx.create(ctx.ref("unmatchFeedback", uid()), {
          matchId: match.id,
          actorId: req.actor,
          reasonCode: body.reasonCode,
          createdAt: ctx.date(),
        });
      return true;
    });
    if (ended) endFirestoreMatchRooms(ctx, req.params.id, "unmatched");
    return { data: { ended: true } };
  });
}
