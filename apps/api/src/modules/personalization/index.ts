import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { Domain, fail, hash, normalizeAnswer } from "../../domain.js";
import { transaction } from "../../db/database.js";
import { object, str, enumString } from "../../schemas.js";
import { gateQuestions, questions, quizVersion, score } from "./catalog.js";
import { registerGames } from "./games.js";

export function registerPersonalization(app: FastifyInstance, d: Domain) {
  transaction(d.db, () =>
    d.db.exec(
      readFileSync(
        new URL("../../db/migrations/002_personalization.sql", import.meta.url),
        "utf8"
      )
    )
  );
  app.get("/v1/personality/questions", async () => ({
    data: {
      version: quizVersion,
      notice:
        "Bộ câu hỏi tự soạn để tham khảo; không phải MBTI chính thức hoặc chẩn đoán.",
      scale: {
        min: 1,
        max: 5,
        labels: [
          "Rất không đồng ý",
          "Không đồng ý",
          "Trung lập",
          "Đồng ý",
          "Rất đồng ý",
        ],
      },
      scoring:
        "Mỗi trục có 6 câu, tổng(value-3). Tổng >=0 chọn E/S/T/J; âm chọn I/N/F/P; hòa chọn chữ đầu. Không dùng dự đoán AI.",
      questions: questions.map(({ id, text, axis }) => ({ id, text, axis })),
    },
  }));
  app.get("/v1/me/personality", async (req) => {
    const draft = d.one(
      "SELECT version,answers_json FROM personality_answers WHERE user_id=?",
      req.actor
    );
    return {
      data: {
        version: quizVersion,
        answers: draft ? JSON.parse(draft.answers_json) : [],
        result: d.profile(req.actor, true).personality,
      },
    };
  });
  app.post(
    "/v1/me/personality/answers",
    {
      schema: {
        body: object(
          {
            version: { const: quizVersion, type: "string" },
            answers: {
              type: "array",
              minItems: 1,
              maxItems: 24,
              items: object({
                questionId: enumString(questions.map((q) => q.id)),
                value: { type: "integer", minimum: 1, maximum: 5 },
              }),
            },
            finalize: { type: "boolean" },
            visible: { type: "boolean" },
          },
          ["version", "answers"]
        ),
      },
    },
    async (req) => {
      const body = req.body as {
        version: string;
        answers: { questionId: string; value: number }[];
        finalize?: boolean;
        visible?: boolean;
      };
      if (
        new Set(body.answers.map((a) => a.questionId)).size !==
        body.answers.length
      )
        fail(422, "QUIZ_DUPLICATE", "Câu hỏi không được lặp");
      const finalize = body.finalize !== false;
      if (finalize && body.answers.length !== 24)
        fail(422, "QUIZ_INCOMPLETE", "Cần đủ 24 câu trả lời khác nhau");
      const answers = [...body.answers].sort(
        (a, b) => Number(a.questionId.slice(1)) - Number(b.questionId.slice(1))
      );
      const result = finalize
        ? {
            code: score(answers),
            version: quizVersion,
            visible: body.visible === true,
          }
        : null;
      transaction(d.db, () => {
        d.run(
          "INSERT INTO personality_answers VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET version=excluded.version,answers_json=excluded.answers_json,updated_at=excluded.updated_at",
          req.actor,
          quizVersion,
          JSON.stringify(answers),
          d.date()
        );
        // Starting a new draft clears the previous public result until completed again.
        d.run(
          "INSERT INTO personalizations(user_id,personality_json) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET personality_json=excluded.personality_json",
          req.actor,
          result ? JSON.stringify(result) : null
        );
      });
      return {
        data: {
          version: quizVersion,
          answered: answers.length,
          complete: finalize,
          result,
        },
      };
    }
  );
  app.patch(
    "/v1/me/personality",
    { schema: { body: object({ visible: { type: "boolean" } }) } },
    async (req) => {
      const row = d.personalization(req.actor);
      if (!row?.personality_json)
        fail(409, "QUIZ_INCOMPLETE", "Chưa có kết quả hoàn chỉnh");
      const result = {
        ...JSON.parse(row.personality_json),
        visible: (req.body as { visible: boolean }).visible,
      };
      d.run(
        "UPDATE personalizations SET personality_json=? WHERE user_id=?",
        JSON.stringify(result),
        req.actor
      );
      return { data: d.profile(req.actor, true).personality };
    }
  );
  app.put(
    "/v1/me/mood",
    {
      schema: {
        body: object(
          {
            text: str(80),
            expiresInHours: {
              type: "number",
              exclusiveMinimum: 0,
              maximum: 24,
            },
          },
          ["text"]
        ),
      },
    },
    async (req) => {
      const body = req.body as { text: string; expiresInHours?: number };
      if (!body.text.trim())
        fail(400, "VALIDATION_ERROR", "Tâm trạng không được trống");
      d.run(
        "INSERT INTO personalizations(user_id,mood_text,mood_expires_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET mood_text=excluded.mood_text,mood_expires_at=excluded.mood_expires_at",
        req.actor,
        body.text.trim(),
        d.config.now() + (body.expiresInHours ?? 24) * 3_600_000
      );
      return { data: d.profile(req.actor, true).mood };
    }
  );
  app.delete("/v1/me/mood", async (req) => {
    d.run(
      "UPDATE personalizations SET mood_text=NULL,mood_expires_at=NULL WHERE user_id=?",
      req.actor
    );
    return { data: null };
  });
  app.get("/v1/like-gate/questions", async () => ({ data: gateQuestions }));
  app.put(
    "/v1/me/like-gate",
    {
      schema: {
        body: object(
          {
            questionId: enumString(gateQuestions.map((q) => q.id)),
            answer: str(100),
            enabled: { type: "boolean" },
          },
          []
        ),
      },
    },
    async (req) => {
      const body = req.body as {
        questionId?: string;
        answer?: string;
        enabled?: boolean;
      };
      if (body.enabled === false) {
        d.run(
          "UPDATE personalizations SET gate_question=NULL,gate_salt=NULL,gate_answer_hash=NULL WHERE user_id=?",
          req.actor
        );
        return { data: null };
      }
      if (!body.questionId || !body.answer || !normalizeAnswer(body.answer))
        fail(400, "VALIDATION_ERROR", "Cần câu hỏi và đáp án không trống");
      const salt = randomBytes(16).toString("hex");
      d.run(
        "INSERT INTO personalizations(user_id,gate_question,gate_version,gate_salt,gate_answer_hash) VALUES(?,?,1,?,?) ON CONFLICT(user_id) DO UPDATE SET gate_question=excluded.gate_question,gate_version=personalizations.gate_version+1,gate_salt=excluded.gate_salt,gate_answer_hash=excluded.gate_answer_hash",
        req.actor,
        body.questionId!,
        salt,
        hash(`${salt}:${normalizeAnswer(body.answer!)}`)
      );
      return {
        data: {
          ...gateQuestions.find((q) => q.id === body.questionId),
          version: d.personalization(req.actor).gate_version,
        },
      };
    }
  );
  app.get<{ Params: { id: string } }>(
    "/v1/profiles/:id/like-gate",
    async (req) => {
      d.target(req.actor, req.params.id);
      if (d.blocked(req.actor, req.params.id) || !d.complete(req.params.id))
        fail(404, "NOT_FOUND", "Không tìm thấy hồ sơ");
      const row = d.personalization(req.params.id);
      const question = gateQuestions.find((q) => q.id === row?.gate_question);
      return {
        data: question ? { ...question, version: row.gate_version } : null,
      };
    }
  );
  app.post(
    "/v1/me/music/connect",
    {
      schema: {
        body: object({ provider: enumString(["spotify", "apple-music"]) }),
      },
    },
    async () => {
      fail(
        503,
        "PROVIDER_UNAVAILABLE",
        "Chưa cấu hình tài khoản developer và OAuth; không nhập dữ liệu nhạc giả."
      );
    }
  );
  app.get("/v1/me/music", async () => ({
    data: {
      mode: "unavailable",
      connected: false,
      tags: [],
      reason: "Chưa có OAuth/provider credentials",
    },
  }));
  app.delete("/v1/me/music", async () => ({ data: { connected: false } }));
  registerGames(app, d);
}
