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
    !ctx.availableUser(userDoc.data()) ||
    (!ctx.config.demoMode && session.mode === "demo")
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
    docs.slice(2).some((x) => !ctx.availableUser(x.data()))
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
export type ProfileRequirement = "displayName" | "dateOfBirth" | "bio" | "media";
export function missingProfileRequirements(
  ctx: FirestoreContext,
  profile: DocumentData | undefined,
  hasValidMedia: boolean = (profile?.mediaIds?.length ?? 0) > 0
): ProfileRequirement[] {
  const missing: ProfileRequirement[] = [];
  if (!profile?.displayName?.trim()) missing.push("displayName");
  if (ctx.age(profile?.dateOfBirth) < 18) missing.push("dateOfBirth");
  if (!profile?.bio?.trim()) missing.push("bio");
  if (!hasValidMedia) missing.push("media");
  return missing;
}
export async function hasValidProfileMedia(
  ctx: FirestoreContext,
  userId: string,
  profile: DocumentData | undefined,
  tx?: Transaction
): Promise<boolean> {
  const mediaIds = (profile?.mediaIds as string[] | undefined) ?? [];
  if (!(mediaIds.length > 0)) return false;
  const refs = mediaIds.map((id) => ctx.ref("media", id));
  const docs = tx ? await tx.getAll(...refs) : await ctx.db.getAll(...refs);
  return docs.some(
    (d) =>
      d.exists &&
      d.data()?.userId === userId &&
      d.data()?.scope === "profile"
  );
}
export const complete = (
  ctx: FirestoreContext,
  profile: DocumentData | undefined,
  hasValidMedia?: boolean
) =>
  !!profile &&
  missingProfileRequirements(ctx, profile, hasValidMedia).length === 0;
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
    const [preferenceDoc, locationDoc, ownProfileDoc] = await ctx.db.getAll(
      ctx.ref("preferences", req.actor),
      ctx.ref("locations", req.actor),
      ctx.ref("profiles", req.actor)
    );
    const ownProfile = ownProfileDoc.data();
    const ownHasMedia = await hasValidProfileMedia(ctx, req.actor, ownProfile);
    const ownMissing = missingProfileRequirements(ctx, ownProfile, ownHasMedia);
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
    let excludedByInteraction = 0;
    let excludedByIncomplete = 0;
    let excludedByFilter = 0;
    let excludedByRadius = 0;
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
        if (target === req.actor || !ctx.availableUser(user)) continue;
        const docs = await ctx.db.getAll(
          ctx.ref("profiles", target),
          ctx.ref("blocks", `${req.actor}_${target}`),
          ctx.ref("blocks", `${target}_${req.actor}`),
          ctx.ref("swipes", `${req.actor}_${target}`),
          ctx.ref("matches", pairDocumentId(req.actor, target)),
          ctx.ref("locations", target)
        );
        if (docs.slice(1, 5).some((document) => document.exists)) {
          excludedByInteraction++;
          continue;
        }
        const profile = docs[0].data();
        if (!complete(ctx, profile) || profile!.visibility !== "public") {
          excludedByIncomplete++;
          continue;
        }
        const age = ctx.age(profile!.dateOfBirth);
        if (
          !preferences.genders.includes(profile!.gender) ||
          age < preferences.minAge ||
          age > preferences.maxAge
        ) {
          excludedByFilter++;
          continue;
        }
        const filters = preferences.advancedFilters ?? {},
          advanced = profile!.advanced ?? {};
        if (
          filters.datingGoal != null &&
          profile!.datingGoal !== filters.datingGoal
        ) {
          excludedByFilter++;
          continue;
        }
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
        ) {
          excludedByFilter++;
          continue;
        }
        if (
          filters.minHeightCm != null &&
          (advanced.heightCm == null || advanced.heightCm < filters.minHeightCm)
        ) {
          excludedByFilter++;
          continue;
        }
        if (
          filters.maxHeightCm != null &&
          (advanced.heightCm == null || advanced.heightCm > filters.maxHeightCm)
        ) {
          excludedByFilter++;
          continue;
        }
        const location = docs[5].data();
        if (
          ownLocation?.consent &&
          location?.consent &&
          kilometres(ownLocation, location) > preferences.radiusKm
        ) {
          excludedByRadius++;
          continue;
        }
        // Recheck block visibility before returning the public profile DTO.
        if (await ctx.blocked(req.actor, target)) {
          excludedByInteraction++;
          continue;
        }
        const dto = await ctx.profile(target);
        if (!(dto.media?.length > 0)) {
          excludedByIncomplete++;
          continue;
        }
        data.push(dto);
        if (data.length === limit) break;
      }
      exhausted =
        consumed === snapshot.size &&
        snapshot.size < Math.min(50, 200 - scanned + consumed);
    }
    let emptyReason: string | undefined;
    if (data.length === 0 && exhausted) {
      if (excludedByFilter > 0 || excludedByRadius > 0) {
        emptyReason =
          "Không có hồ sơ khớp với bộ lọc hoặc bán kính hiện tại. Bạn có thể mở Bộ lọc cơ bản hoặc cập nhật vị trí GPS rồi thử lại.";
      } else if (excludedByInteraction > 0 && excludedByIncomplete > 0) {
        emptyReason =
          "Bạn đã xem hoặc tương tác hết các hồ sơ đủ điều kiện hiện có; các tài khoản còn lại chưa hoàn thiện hồ sơ (thiếu giới thiệu hoặc ảnh).";
      } else if (excludedByInteraction > 0) {
        emptyReason =
          "Bạn đã xem hoặc tương tác hết các hồ sơ đủ điều kiện hiện tại (các hồ sơ đã Thích, Bỏ qua, Chặn hoặc đã kết thúc kết nối sẽ không hiện lại).";
      } else if (excludedByIncomplete > 0) {
        emptyReason =
          "Chưa có hồ sơ công khai nào khác hoàn thiện đủ thông tin (tên, ngày sinh 18+, giới thiệu và ít nhất 1 ảnh).";
      } else {
        emptyReason = "Hiện chưa có tài khoản nào khác khả dụng trong hệ thống.";
      }
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
        ownProfileComplete: ownMissing.length === 0,
        missingRequirements: ownMissing,
        ...(emptyReason ? { emptyReason } : {}),
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
        if (!ctx.availableUser(target))
          fail(404, "NOT_FOUND", "Không tìm thấy hồ sơ");
        const ownHasMedia = await hasValidProfileMedia(
          ctx,
          actor,
          ownProfile,
          tx
        );
        const targetHasMedia = await hasValidProfileMedia(
          ctx,
          targetUserId,
          targetProfile,
          tx
        );
        const ownMissing = missingProfileRequirements(
          ctx,
          ownProfile,
          ownHasMedia
        );
        if (!ctx.availableUser(ownUser) || ownMissing.length > 0) {
          const labels: Record<ProfileRequirement, string> = {
            displayName: "tên hiển thị",
            dateOfBirth: "ngày sinh đủ 18 tuổi",
            bio: "phần giới thiệu",
            media: "ít nhất 1 ảnh hồ sơ",
          };
          const detail = ownMissing.map((key) => labels[key]).join(", ");
          fail(
            422,
            "PROFILE_INCOMPLETE",
            detail
              ? `Hồ sơ của bạn chưa đầy đủ (thiếu ${detail}). Hãy vào mục Tôi để hoàn thiện trước khi tương tác.`
              : "Hồ sơ của bạn hiện không khả dụng."
          );
        }
        if (
          block ||
          reverseBlock ||
          !complete(ctx, targetProfile, targetHasMedia) ||
          targetProfile?.visibility !== "public"
        )
          fail(
            422,
            "PROFILE_UNAVAILABLE",
            "Hồ sơ đối phương hiện không khả dụng hoặc chưa đầy đủ"
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
        return { swipeId: savedSwipe.id, match: savedMatch, created: !match && !!savedMatch };
      });
      if (result.created && result.match) {
        const { authenticate } = await import("./auth.js");
        for (const memberId of result.match.memberIds) {
          try {
            await requireActiveFirestoreMatch(ctx, memberId, id);
            for (const socket of ctx.io.sockets.sockets.values()) {
              if (socket.data.userId !== memberId) continue;
              try { await authenticate(ctx, socket.data.token); }
              catch { socket.disconnect(true); }
            }
            ctx.io.to(`user:${memberId}`).emit("match:created", { matchId: id });
          } catch (error: any) {
            if (!["MATCH_INACTIVE", "NOT_FOUND"].includes(error.code)) throw error;
          }
        }
      }
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
