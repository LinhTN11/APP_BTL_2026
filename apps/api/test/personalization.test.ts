import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app.js";
import { Domain } from "../src/domain.js";
import { demoIds } from "../src/db/database.js";
import { registerPersonalization } from "../src/modules/personalization/index.js";

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "gap-personalization-"));
  let now = Date.parse("2026-11-01T03:00:00Z");
  let app: Awaited<ReturnType<typeof createApp>>;
  const open = async () => {
    app = await createApp({ dataDir: dir, now: () => now });
    if (!app.hasRoute({ method: "GET", url: "/v1/personality/questions" })) {
      const d = new Domain(app.db, app.config);
      d.io = app.io;
      registerPersonalization(app, d);
    }
  };
  await open();
  const call = (method: any, url: string, token?: string, payload?: any) =>
    app.inject({
      method,
      url,
      headers: token ? { authorization: `Bearer ${token}` } : {},
      ...(payload !== undefined ? { payload } : {}),
    });
  const login = async (account: string) =>
    (await call("POST", "/v1/demo/sessions", undefined, { account })).json()
      .data.token as string;
  return {
    get app() {
      return app;
    },
    call,
    login,
    advance: (ms: number) => {
      now += ms;
    },
    restart: async () => {
      await app.close();
      await open();
    },
    close: async () => {
      await app.close();
      await rm(dir, { recursive: true, force: true });
    },
  };
}
const completeAnswers = () =>
  Array.from({ length: 24 }, (_, i) => ({ questionId: `q${i + 1}`, value: 5 }));

test("advanced declared fields: null, bounds, intersections and persistence", async () => {
  const f = await fixture();
  try {
    const a = await f.login("A"),
      b = await f.login("B");
    assert.equal(
      (await f.call("GET", `/v1/profiles/${demoIds.B}`, a)).json().data.advanced
        .heightCm,
      null
    );
    assert.equal(
      (
        await f.call("PATCH", "/v1/me/profile", b, {
          advanced: {
            children: "none",
            heightCm: 170,
            education: "University",
            religion: null,
            hometown: "Hà Nội",
          },
        })
      ).statusCode,
      200
    );
    assert.equal(
      (
        await f.call("PATCH", "/v1/me/profile", b, {
          advanced: { heightCm: 99 },
        })
      ).statusCode,
      400
    );
    assert.equal(
      (
        await f.call("PATCH", "/v1/me/profile", b, {
          advanced: { children: false },
        })
      ).statusCode,
      400
    );
    const previousName = (await f.call("GET", "/v1/me/profile", b)).json().data
      .displayName;
    assert.equal(
      (
        await f.call("PATCH", "/v1/me/profile", b, {
          displayName: "Changed",
          advanced: { education: " " },
        })
      ).statusCode,
      400
    );
    assert.equal(
      (await f.call("GET", "/v1/me/profile", b)).json().data.displayName,
      previousName
    );
    assert.equal(
      (
        await f.call("PATCH", "/v1/me/preferences", a, {
          advancedFilters: {
            children: "none",
            minHeightCm: 160,
            maxHeightCm: 180,
            education: "university",
            hometown: "Hà Nội",
          },
        })
      ).statusCode,
      200
    );
    let results = (await f.call("GET", "/v1/discovery", a)).json().data;
    assert.deepEqual(
      results.map((p: any) => p.userId),
      [demoIds.B]
    );
    assert.equal(
      (
        await f.call("PATCH", "/v1/me/preferences", a, {
          advancedFilters: { minHeightCm: 190, maxHeightCm: 180 },
        })
      ).statusCode,
      422
    );
    assert.equal(
      (
        await f.call("PATCH", "/v1/me/profile", b, {
          advanced: { heightCm: null },
        })
      ).statusCode,
      200
    );
    assert.equal(
      (await f.call("GET", "/v1/discovery", a)).json().data.length,
      0
    );
    await f.restart();
    const profile = (await f.call("GET", "/v1/me/profile", b)).json().data;
    assert.equal(profile.advanced.heightCm, null);
    assert.equal(profile.advanced.education, "University");
    assert.equal(
      (await f.call("GET", "/v1/me/preferences", a)).json().data.advancedFilters
        .minHeightCm,
      160
    );
    assert.equal(
      (
        f.app.db
          .prepare("SELECT count(*) n FROM migrations WHERE version=2")
          .get() as any
      ).n,
      1
    );
  } finally {
    await f.close();
  }
});

test("original quiz validates full unique set, saves private draft, scores deterministically and hides result", async () => {
  const f = await fixture();
  try {
    const a = await f.login("A"),
      b = await f.login("B");
    const quiz = (await f.call("GET", "/v1/personality/questions", a)).json()
      .data;
    assert.equal(quiz.questions.length, 24);
    assert.equal(quiz.version, "preference-v1");
    const submit = (answers: any[], extra: object = {}) =>
      f.call("POST", "/v1/me/personality/answers", a, {
        version: quiz.version,
        answers,
        ...extra,
      });
    assert.equal(
      (await submit(completeAnswers().slice(0, 23))).json().error.code,
      "QUIZ_INCOMPLETE"
    );
    assert.equal(
      (
        await submit([...completeAnswers().slice(0, 23), completeAnswers()[0]])
      ).json().error.code,
      "QUIZ_DUPLICATE"
    );
    assert.equal(
      (await submit([{ questionId: "q100", value: 5 }])).statusCode,
      400
    );
    assert.equal(
      (await submit([{ questionId: "q1", value: 6 }])).statusCode,
      400
    );
    assert.equal(
      (
        await f.call("POST", "/v1/me/personality/answers", a, {
          version: "unknown",
          answers: completeAnswers(),
        })
      ).statusCode,
      400
    );
    assert.equal(
      (await submit(completeAnswers().slice(0, 3), { finalize: false })).json()
        .data.complete,
      false
    );
    assert.equal(
      (await f.call("GET", "/v1/me/personality", a)).json().data.answers.length,
      3
    );
    assert.equal(
      (await f.call("GET", `/v1/profiles/${demoIds.A}`, b)).json().data
        .personality,
      null
    );
    const first = (await submit(completeAnswers(), { visible: true })).json()
      .data.result;
    assert.equal(first.code, "ESTJ");
    assert.deepEqual(
      (await submit(completeAnswers(), { visible: true })).json().data.result,
      first
    );
    const pub = (await f.call("GET", `/v1/profiles/${demoIds.A}`, b)).json()
      .data;
    assert.deepEqual(pub.personality, { code: "ESTJ", version: quiz.version });
    assert.equal(JSON.stringify(pub).includes("answers"), false);
    await f.call("PATCH", "/v1/me/personality", a, { visible: false });
    assert.equal(
      (await f.call("GET", `/v1/profiles/${demoIds.A}`, b)).json().data
        .personality,
      null
    );
    const tied = completeAnswers().map((x) => ({ ...x, value: 3 }));
    assert.equal((await submit(tied)).json().data.result.code, "ESTJ");
    const opposite = completeAnswers().map((x) => ({ ...x, value: 1 }));
    assert.equal((await submit(opposite)).json().data.result.code, "INFP");
    await f.restart();
    assert.equal(
      (await f.call("GET", "/v1/me/personality", a)).json().data.answers.length,
      24
    );
    assert.equal(
      (await f.call("GET", "/v1/me/profile", a)).json().data.personality.code,
      "INFP"
    );
  } finally {
    await f.close();
  }
});

test("mood expires on server clock, deletion works, music never claims provider import", async () => {
  const f = await fixture();
  try {
    const a = await f.login("A"),
      b = await f.login("B");
    assert.equal(
      (
        await f.call("PUT", "/v1/me/mood", b, {
          text: "Sẵn sàng cà phê",
          expiresInHours: 25,
        })
      ).statusCode,
      400
    );
    assert.equal(
      (await f.call("PUT", "/v1/me/mood", b, { text: " ", expiresInHours: 1 }))
        .statusCode,
      400
    );
    const result = await f.call("PUT", "/v1/me/mood", b, {
      text: "Sẵn sàng cà phê",
      expiresInHours: 1,
    });
    assert.equal(result.statusCode, 200);
    assert.equal(
      Date.parse(result.json().data.expiresAt),
      Date.parse("2026-11-01T04:00:00Z")
    );
    assert.equal(
      (await f.call("GET", `/v1/profiles/${demoIds.B}`, a)).json().data.mood
        .text,
      "Sẵn sàng cà phê"
    );
    f.advance(3_600_000);
    assert.equal(
      (await f.call("GET", `/v1/profiles/${demoIds.B}`, a)).json().data.mood,
      null
    );
    await f.call("PUT", "/v1/me/mood", b, { text: "Tươi vui" });
    await f.call("DELETE", "/v1/me/mood", b);
    assert.equal(
      (await f.call("GET", `/v1/profiles/${demoIds.B}`, a)).json().data.mood,
      null
    );
    const connect = await f.call("POST", "/v1/me/music/connect", a, {
      provider: "spotify",
    });
    assert.equal(connect.statusCode, 503);
    assert.equal(connect.json().error.code, "PROVIDER_UNAVAILABLE");
    assert.deepEqual(
      (await f.call("GET", "/v1/me/music", a)).json().data.tags,
      []
    );
    assert.equal(
      (await f.call("GET", "/v1/me/music", a)).json().data.connected,
      false
    );
  } finally {
    await f.close();
  }
});

test("gate answer stays secret, wrong or stale answers cannot write like; pass bypasses gate and retry is unique", async () => {
  const f = await fixture();
  try {
    const a = await f.login("A"),
      b = await f.login("B"),
      c = await f.login("C");
    const set = await f.call("PUT", "/v1/me/like-gate", b, {
      questionId: "favorite-color",
      answer: "Xanh lam",
    });
    assert.equal(set.statusCode, 200);
    const gate = await f.call("GET", `/v1/profiles/${demoIds.B}/like-gate`, a);
    assert.deepEqual(Object.keys(gate.json().data).sort(), [
      "id",
      "text",
      "version",
    ]);
    const pub = await f.call("GET", `/v1/profiles/${demoIds.B}`, a);
    assert.equal(pub.body.includes("Xanh lam"), false);
    assert.equal(
      (
        f.app.db
          .prepare(
            "SELECT gate_answer_hash FROM personalizations WHERE user_id=?"
          )
          .get(demoIds.B) as any
      ).gate_answer_hash.includes("Xanh lam"),
      false
    );
    const like = (answer?: string) =>
      f.call("POST", "/v1/swipes", a, {
        targetUserId: demoIds.B,
        action: "like",
        ...(answer ? { gateAnswer: answer } : {}),
      });
    assert.equal((await like()).json().error.code, "GATE_ANSWER_INVALID");
    assert.equal((await like("sai")).json().error.code, "GATE_ANSWER_INVALID");
    assert.equal(
      (
        f.app.db
          .prepare(
            "SELECT count(*) n FROM swipes WHERE actor_id=? AND target_id=?"
          )
          .get(demoIds.A, demoIds.B) as any
      ).n,
      0
    );
    await f.call("PUT", "/v1/me/like-gate", b, {
      questionId: "favorite-season",
      answer: "Mùa thu",
    });
    assert.equal(
      (await like("Xanh lam")).json().error.code,
      "GATE_ANSWER_INVALID"
    );
    assert.equal(
      (
        await f.call("POST", "/v1/swipes", c, {
          targetUserId: demoIds.B,
          action: "pass",
        })
      ).statusCode,
      200
    );
    const good = await like("  MÙA THU  ");
    assert.equal(good.statusCode, 200);
    assert.equal(
      (await like("mùa thu")).json().data.swipeId,
      good.json().data.swipeId
    );
    assert.equal(
      (
        f.app.db
          .prepare(
            "SELECT count(*) n FROM swipes WHERE actor_id=? AND target_id=?"
          )
          .get(demoIds.A, demoIds.B) as any
      ).n,
      1
    );
    assert.equal(
      (await f.call("PUT", "/v1/me/like-gate", b, { enabled: false }))
        .statusCode,
      200
    );
    const other = await f.login("D");
    assert.equal(
      (
        await f.call("POST", "/v1/swipes", other, {
          targetUserId: demoIds.B,
          action: "like",
        })
      ).statusCode,
      200
    );
    await f.call("POST", "/v1/blocks", a, { targetUserId: demoIds.B });
    assert.equal(
      (await f.call("GET", `/v1/profiles/${demoIds.B}/like-gate`, a))
        .statusCode,
      404
    );
  } finally {
    await f.close();
  }
});

test("truth-or-dare uses finite authored prompts and block closes games", async () => {
  const f = await fixture();
  try {
    const a = await f.login("A"),
      b = await f.login("B");
    await f.call("POST", "/v1/swipes", a, {
      targetUserId: demoIds.B,
      action: "like",
    });
    const match = (
      await f.call("POST", "/v1/swipes", b, {
        targetUserId: demoIds.A,
        action: "like",
      })
    ).json().data.match.id;
    const game = (
      await f.call("POST", `/v1/matches/${match}/games`, a, {
        kind: "truth-or-dare",
        requestId: randomUUID(),
      })
    ).json().data;
    const turn = (token: string, payload: object) =>
      f.call("POST", `/v1/games/${game.id}/turns`, token, payload);
    const accepted = await turn(b, {
      requestId: randomUUID(),
      expectedVersion: 0,
      action: "accept",
    });
    assert.equal(accepted.statusCode, 200);
    assert.equal(typeof accepted.json().data.game.prompt.truth, "string");
    assert.equal(typeof accepted.json().data.game.prompt.dare, "string");
    assert.equal(
      (
        await turn(a, {
          requestId: randomUUID(),
          expectedVersion: 1,
          action: "answer",
          answer: "Câu trả lời",
        })
      ).statusCode,
      400
    );
    for (let i = 0; i < 20; i++) {
      const response = await turn(i % 2 === 0 ? a : b, {
        requestId: randomUUID(),
        expectedVersion: i + 1,
        action: i === 0 ? "answer" : "skip",
        ...(i === 0 ? { choice: "truth", answer: "Học vẽ" } : {}),
      });
      assert.equal(response.statusCode, 200);
      assert.equal(response.json().data.game.promptIndex, i + 1);
      assert.equal(
        response.json().data.game.status,
        i === 19 ? "ended" : "active"
      );
    }
    const newGame = (
      await f.call("POST", `/v1/matches/${match}/games`, a, {
        kind: "twenty-questions",
        requestId: randomUUID(),
      })
    ).json().data;
    assert.equal(
      (await f.call("POST", "/v1/blocks", a, { targetUserId: demoIds.B }))
        .statusCode,
      200
    );
    assert.equal(
      (await f.call("GET", `/v1/games/${newGame.id}`, b)).statusCode,
      403
    );
    assert.equal(
      (
        f.app.db
          .prepare("SELECT status FROM games WHERE id=?")
          .get(newGame.id) as any
      ).status,
      "ended"
    );
  } finally {
    await f.close();
  }
});

test("gate rate limit is persistent and bounded by server time", async () => {
  const f = await fixture();
  try {
    const a = await f.login("A"),
      b = await f.login("B");
    await f.call("PUT", "/v1/me/like-gate", b, {
      questionId: "favorite-pet",
      answer: "mèo",
    });
    for (let i = 0; i < 5; i++)
      assert.equal(
        (
          await f.call("POST", "/v1/swipes", a, {
            targetUserId: demoIds.B,
            action: "like",
            gateAnswer: "wrong",
          })
        ).statusCode,
        422
      );
    await f.restart();
    assert.equal(
      (
        await f.call("POST", "/v1/swipes", a, {
          targetUserId: demoIds.B,
          action: "like",
          gateAnswer: "mèo",
        })
      ).json().error.code,
      "GATE_RATE_LIMIT"
    );
    f.advance(900_001);
    assert.equal(
      (
        await f.call("POST", "/v1/swipes", a, {
          targetUserId: demoIds.B,
          action: "like",
          gateAnswer: "mèo",
        })
      ).statusCode,
      200
    );
  } finally {
    await f.close();
  }
});

test("games require active membership, consent, turn versions and exact request retries", async () => {
  const f = await fixture();
  try {
    const a = await f.login("A"),
      b = await f.login("B"),
      c = await f.login("C");
    await f.call("POST", "/v1/swipes", a, {
      targetUserId: demoIds.B,
      action: "like",
    });
    const match = (
      await f.call("POST", "/v1/swipes", b, {
        targetUserId: demoIds.A,
        action: "like",
      })
    ).json().data.match.id;
    const create = { kind: "twenty-questions", requestId: randomUUID() };
    assert.equal(
      (await f.call("POST", `/v1/matches/${match}/games`, c, create))
        .statusCode,
      404
    );
    const invited = (
      await f.call("POST", `/v1/matches/${match}/games`, a, create)
    ).json().data;
    assert.equal(invited.status, "invited");
    assert.equal(
      (await f.call("POST", `/v1/matches/${match}/games`, a, create)).json()
        .data.id,
      invited.id
    );
    assert.equal(
      (await f.call("GET", `/v1/games/${invited.id}`, c)).statusCode,
      404
    );
    const turn = (token: string, payload: object) =>
      f.call("POST", `/v1/games/${invited.id}/turns`, token, payload);
    assert.equal(
      (
        await turn(a, {
          requestId: randomUUID(),
          expectedVersion: 0,
          action: "accept",
        })
      ).json().error.code,
      "TURN_CONFLICT"
    );
    assert.equal(
      (
        await turn(b, {
          requestId: randomUUID(),
          expectedVersion: 0,
          action: "answer",
          answer: "abc",
        })
      ).json().error.code,
      "GAME_NOT_ACCEPTED"
    );
    const accepted = (
      await turn(b, {
        requestId: randomUUID(),
        expectedVersion: 0,
        action: "accept",
      })
    ).json().data;
    assert.equal(accepted.game.version, 1);
    assert.equal(accepted.game.nextActorId, demoIds.A);
    assert.equal(
      (
        await turn(c, {
          requestId: randomUUID(),
          expectedVersion: 1,
          action: "end",
        })
      ).statusCode,
      404
    );
    assert.equal(
      (
        await turn(a, {
          requestId: randomUUID(),
          expectedVersion: 0,
          action: "skip",
        })
      ).json().error.code,
      "VERSION_CONFLICT"
    );
    const req = {
      requestId: randomUUID(),
      expectedVersion: 1,
      action: "answer",
      answer: "Học vẽ",
    };
    const answered = (await turn(a, req)).json().data;
    assert.equal(answered.game.promptIndex, 1);
    assert.deepEqual((await turn(a, req)).json().data, answered);
    assert.equal(
      (await turn(a, { ...req, answer: "different" })).json().error.code,
      "REQUEST_CONFLICT"
    );
    assert.equal(
      (
        f.app.db
          .prepare("SELECT count(*) n FROM game_turns WHERE game_id=?")
          .get(invited.id) as any
      ).n,
      2
    );
    assert.equal(
      (
        await turn(b, {
          requestId: randomUUID(),
          expectedVersion: 2,
          action: "skip",
        })
      ).json().data.game.promptIndex,
      2
    );
    await f.restart();
    const restored = (await f.call("GET", `/v1/games/${invited.id}`, b)).json()
      .data;
    assert.equal(restored.version, 3);
    assert.equal(
      restored.turns.find((turn: any) => turn.action === "answer").answer,
      "Học vẽ"
    );
    assert.equal(
      (
        await turn(a, {
          requestId: randomUUID(),
          expectedVersion: 3,
          action: "end",
        })
      ).json().data.game.status,
      "ended"
    );
    assert.equal(
      (
        await turn(b, {
          requestId: randomUUID(),
          expectedVersion: 4,
          action: "skip",
        })
      ).json().error.code,
      "GAME_ENDED"
    );
    const second = (
      await f.call("POST", `/v1/matches/${match}/games`, b, {
        kind: "truth-or-dare",
        requestId: randomUUID(),
      })
    ).json().data;
    await f.call("DELETE", `/v1/matches/${match}`, a);
    assert.equal(
      (
        f.app.db
          .prepare("SELECT status FROM games WHERE id=?")
          .get(second.id) as any
      ).status,
      "ended"
    );
    assert.equal(
      (await f.call("GET", `/v1/games/${second.id}`, b)).statusCode,
      403
    );
    assert.equal(
      (
        await f.call("POST", `/v1/games/${second.id}/turns`, b, {
          requestId: randomUUID(),
          expectedVersion: 0,
          action: "end",
        })
      ).statusCode,
      403
    );
    assert.equal(
      (
        await f.call("POST", `/v1/matches/${match}/games`, b, {
          kind: "truth-or-dare",
          requestId: randomUUID(),
        })
      ).statusCode,
      403
    );
  } finally {
    await f.close();
  }
});
