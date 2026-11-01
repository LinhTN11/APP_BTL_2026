import type { FastifyInstance } from "fastify";
import { Domain, fail, uid } from "../../domain.js";
import { transaction } from "../../db/database.js";
import { object, str, enumString, uuid } from "../../schemas.js";
import { twentyQuestions, truthOrDare } from "./catalog.js";

function state(d: Domain, row: any) {
  const match = d.one("SELECT * FROM matches WHERE id=?", row.match_id);
  const ended =
    match.status !== "active" || d.blocked(match.user_low, match.user_high);
  return {
    id: row.id,
    matchId: row.match_id,
    kind: row.kind,
    status: ended ? "ended" : row.status,
    version: row.version,
    nextActorId: ended || row.status === "ended" ? null : row.next_actor_id,
    promptIndex: row.prompt_index,
    prompt:
      ended || row.status !== "active"
        ? null
        : row.kind === "twenty-questions"
        ? twentyQuestions[row.prompt_index]
        : truthOrDare[row.prompt_index],
    createdAt: row.created_at,
  };
}
function access(d: Domain, actor: string, id: string) {
  const row = d.one("SELECT * FROM games WHERE id=?", id);
  if (!row) return fail(404, "NOT_FOUND", "Không tìm thấy trò chơi");
  d.matchAccess(actor, row.match_id);
  return row;
}
export function registerGames(app: FastifyInstance, d: Domain) {
  app.post<{ Params: { id: string } }>(
    "/v1/matches/:id/games",
    {
      schema: {
        body: object({
          kind: enumString(["truth-or-dare", "twenty-questions"]),
          requestId: uuid,
        }),
      },
    },
    async (req) => {
      const match = d.matchAccess(req.actor, req.params.id);
      const body = req.body as { kind: string; requestId: string };
      return {
        data: transaction(d.db, () => {
          let row = d.one(
            "SELECT * FROM games WHERE creator_id=? AND request_id=?",
            req.actor,
            body.requestId
          );
          if (row) {
            if (row.match_id !== match.id || row.kind !== body.kind)
              fail(
                409,
                "REQUEST_CONFLICT",
                "requestId đã dùng với dữ liệu khác"
              );
          } else {
            if (
              d.one(
                "SELECT 1 FROM games WHERE match_id=? AND status IN ('invited','active')",
                match.id
              )
            )
              fail(
                409,
                "GAME_EXISTS",
                "Đã có lời mời hoặc trò chơi đang diễn ra"
              );
            const id = uid();
            d.run(
              "INSERT INTO games(id,match_id,creator_id,kind,status,next_actor_id,request_id,created_at) VALUES(?,?,?,?,'invited',?,?,?)",
              id,
              match.id,
              req.actor,
              body.kind,
              req.actor === match.user_low ? match.user_high : match.user_low,
              body.requestId,
              d.date()
            );
            row = d.one("SELECT * FROM games WHERE id=?", id);
          }
          return state(d, row);
        }),
      };
    }
  );
  app.get<{ Params: { id: string } }>("/v1/games/:id", async (req) => {
    const row = access(d, req.actor, req.params.id);
    const turns = d
      .all(
        "SELECT id,actor_id,request_json,created_at FROM game_turns WHERE game_id=? ORDER BY rowid",
        row.id
      )
      .map((turn) => {
        const request = JSON.parse(turn.request_json);
        return {
          id: turn.id,
          actorId: turn.actor_id,
          action: request.action,
          answer: request.answer,
          choice: request.choice,
          createdAt: turn.created_at,
        };
      });
    return { data: { ...state(d, row), turns } };
  });
  app.get<{ Params: { id: string } }>("/v1/matches/:id/games", async (req) => {
    d.matchAccess(req.actor, req.params.id);
    return {
      data: d
        .all(
          "SELECT * FROM games WHERE match_id=? ORDER BY created_at,id",
          req.params.id
        )
        .map((row) => state(d, row)),
    };
  });
  app.post<{ Params: { id: string } }>(
    "/v1/games/:id/turns",
    {
      schema: {
        body: object(
          {
            requestId: uuid,
            expectedVersion: { type: "integer", minimum: 0 },
            action: enumString(["accept", "answer", "skip", "end"]),
            answer: str(500),
            choice: enumString(["truth", "dare"]),
          },
          ["requestId", "expectedVersion", "action"]
        ),
      },
    },
    async (req) => {
      const body = req.body as {
        requestId: string;
        expectedVersion: number;
        action: string;
        answer?: string;
        choice?: string;
      };
      const row = access(d, req.actor, req.params.id);
      return {
        data: transaction(d.db, () => {
          const serialized = JSON.stringify({
            gameId: row.id,
            expectedVersion: body.expectedVersion,
            action: body.action,
            answer: body.answer ?? null,
            choice: body.choice ?? null,
          });
          const prior = d.one(
            "SELECT * FROM game_turns WHERE actor_id=? AND request_id=?",
            req.actor,
            body.requestId
          );
          if (prior) {
            if (prior.request_json !== serialized)
              fail(
                409,
                "REQUEST_CONFLICT",
                "requestId đã dùng với dữ liệu khác"
              );
            return JSON.parse(prior.response_json);
          }
          if (row.status === "ended")
            fail(409, "GAME_ENDED", "Trò chơi đã kết thúc");
          if (row.version !== body.expectedVersion)
            fail(409, "VERSION_CONFLICT", "Tải lại trạng thái trò chơi");
          if (body.action !== "end" && row.next_actor_id !== req.actor)
            fail(409, "TURN_CONFLICT", "Chưa tới lượt của bạn");
          if (
            row.status === "invited" &&
            !["accept", "end"].includes(body.action)
          )
            fail(409, "GAME_NOT_ACCEPTED", "Cần chấp nhận lời mời");
          if (row.status === "active" && body.action === "accept")
            fail(409, "GAME_ALREADY_ACTIVE", "Trò chơi đã bắt đầu");
          if (body.action === "answer" && !body.answer?.trim())
            fail(400, "VALIDATION_ERROR", "Cần câu trả lời hoặc chọn bỏ qua");
          if (
            row.kind === "truth-or-dare" &&
            body.action === "answer" &&
            !body.choice
          )
            fail(400, "VALIDATION_ERROR", "Chọn truth hoặc dare");
          const match = d.matchAccess(req.actor, row.match_id);
          const next =
            req.actor === match.user_low ? match.user_high : match.user_low;
          const index =
            row.prompt_index +
            (["answer", "skip"].includes(body.action) ? 1 : 0);
          const status =
            body.action === "end" || index >= 20 ? "ended" : "active";
          d.run(
            "UPDATE games SET status=?,version=version+1,prompt_index=?,next_actor_id=? WHERE id=?",
            status,
            index,
            next,
            row.id
          );
          const result = {
            game: state(d, d.one("SELECT * FROM games WHERE id=?", row.id)),
            turn: {
              actorId: req.actor,
              action: body.action,
              ...(body.answer ? { answer: body.answer } : {}),
              ...(body.choice ? { choice: body.choice } : {}),
            },
          };
          d.run(
            "INSERT INTO game_turns VALUES(?,?,?,?,?,?,?)",
            uid(),
            row.id,
            req.actor,
            body.requestId,
            serialized,
            JSON.stringify(result),
            d.date()
          );
          return result;
        }),
      };
    }
  );
}
