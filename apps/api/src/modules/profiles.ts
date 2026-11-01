import type { FastifyInstance } from "fastify";
import { Domain, fail } from "../domain.js";
import { object, profilePatch, preferencesPatch, coords } from "../schemas.js";
import { transaction } from "../db/database.js";
export function registerProfiles(app: FastifyInstance, d: Domain) {
  app.get("/v1/me/profile", async (req) => ({
    data: d.profile(req.actor, true),
  }));
  app.patch(
    "/v1/me/profile",
    { schema: { body: profilePatch } },
    async (req) => {
      const body = req.body as any;
      if (body.dateOfBirth) {
        const date = new Date(body.dateOfBirth + "T00:00:00Z");
        if (
          Number.isNaN(date.getTime()) ||
          date.toISOString().slice(0, 10) !== body.dateOfBirth ||
          d.age(body.dateOfBirth) < 18 ||
          d.age(body.dateOfBirth) > 120
        )
          fail(
            422,
            "AGE_INVALID",
            "Ngày sinh hợp lệ và đủ 18 tuổi là bắt buộc"
          );
      }
      if (body.displayName !== undefined && !body.displayName.trim())
        fail(400, "VALIDATION_ERROR", "Tên không được trống");
      if (body.advanced) {
        for (const item of Object.values(body.advanced))
          if (typeof item === "string" && !item.trim())
            fail(400, "VALIDATION_ERROR", "Trường mở rộng không được trống");
      }
      const fields: Record<string, string> = {
        displayName: "display_name",
        dateOfBirth: "date_of_birth",
        gender: "gender",
        bio: "bio",
        datingGoal: "dating_goal",
        interests: "interests_json",
        lifestyle: "lifestyle_json",
      };
      transaction(d.db, () => {
        for (const [key, value] of Object.entries(body))
          if (key === "advanced") {
            const advanced = {
              ...JSON.parse(
                d.personalization(req.actor)?.advanced_json ?? "{}"
              ),
              ...(value as object),
            };
            d.run(
              "INSERT INTO personalizations(user_id,advanced_json) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET advanced_json=excluded.advanced_json",
              req.actor,
              JSON.stringify(advanced)
            );
          } else
            d.run(
              `UPDATE profiles SET ${fields[key]}=? WHERE user_id=?`,
              key === "interests" || key === "lifestyle"
                ? JSON.stringify(value)
                : (value as string),
              req.actor
            );
      });
      return { data: d.profile(req.actor, true) };
    }
  );
  app.get<{ Params: { id: string } }>("/v1/profiles/:id", async (req) => {
    d.target(req.actor, req.params.id);
    if (d.blocked(req.actor, req.params.id) || !d.complete(req.params.id))
      fail(404, "NOT_FOUND", "Không tìm thấy hồ sơ");
    return { data: d.profile(req.params.id) };
  });
  app.get("/v1/me/preferences", async (req) => ({ data: prefs(d, req.actor) }));
  app.patch(
    "/v1/me/preferences",
    { schema: { body: preferencesPatch } },
    async (req) => {
      const p = { ...prefs(d, req.actor), ...(req.body as any) };
      if (p.minAge > p.maxAge)
        fail(422, "AGE_RANGE_INVALID", "minAge không được lớn hơn maxAge");
      if ((req.body as any).advancedFilters !== undefined) {
        p.advancedFilters = {
          ...prefs(d, req.actor).advancedFilters,
          ...(req.body as any).advancedFilters,
        };
        const f = p.advancedFilters;
        if (
          f.minHeightCm != null &&
          f.maxHeightCm != null &&
          f.minHeightCm > f.maxHeightCm
        )
          fail(422, "HEIGHT_RANGE_INVALID", "Khoảng chiều cao không hợp lệ");
        for (const item of Object.values(f))
          if (typeof item === "string" && !item.trim())
            fail(400, "VALIDATION_ERROR", "Bộ lọc không được trống");
        d.run(
          "INSERT INTO personalizations(user_id,filters_json) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET filters_json=excluded.filters_json",
          req.actor,
          JSON.stringify(f)
        );
      }
      d.run(
        "UPDATE discovery_preferences SET genders_json=?,min_age=?,max_age=?,radius_km=? WHERE user_id=?",
        JSON.stringify(p.genders),
        p.minAge,
        p.maxAge,
        p.radiusKm,
        req.actor
      );
      return { data: p };
    }
  );
  app.put(
    "/v1/me/location",
    {
      schema: {
        body: object({
          ...coords.properties,
          consent: { const: true, type: "boolean" },
        }),
      },
    },
    async (req) => {
      const b = req.body as any;
      d.run(
        "INSERT INTO locations VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET latitude=excluded.latitude,longitude=excluded.longitude,updated_at=excluded.updated_at",
        req.actor,
        b.latitude,
        b.longitude,
        d.date()
      );
      return { data: { consent: true, updatedAt: d.date() } };
    }
  );
  app.delete("/v1/me/location", async (req) => {
    d.run("DELETE FROM locations WHERE user_id=?", req.actor);
    return { data: { consent: false } };
  });
}
export function prefs(d: Domain, id: string) {
  const r = d.one("SELECT * FROM discovery_preferences WHERE user_id=?", id);
  return {
    genders: JSON.parse(r.genders_json),
    minAge: r.min_age,
    maxAge: r.max_age,
    radiusKm: r.radius_km,
    advancedFilters: JSON.parse(d.personalization(id)?.filters_json ?? "{}"),
  };
}
