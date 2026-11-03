export const str = (maxLength = 200) => ({
  type: "string",
  minLength: 1,
  maxLength,
});
export const uuid = { type: "string", format: "uuid" };
export const object = (
  properties: Record<string, any>,
  required: string[] = Object.keys(properties)
) => ({ type: "object", additionalProperties: false, properties, required });
export const enumString = (values: string[]) => ({
  type: "string",
  enum: values,
});
export const genders = ["female", "male", "other"];
export const childrenValues = [
  "none",
  "have",
  "want",
  "unsure",
  "prefer_not_to_say",
];
const nullable = (schema: Record<string, any>) => ({
  anyOf: [schema, { type: "null" }],
});
export const advancedProfile = object(
  {
    children: nullable(enumString(childrenValues)),
    heightCm: nullable({ type: "integer", minimum: 100, maximum: 250 }),
    education: nullable(str(80)),
    religion: nullable(str(80)),
    hometown: nullable(str(100)),
  },
  []
);
export const advancedFilters = object(
  {
    children: nullable(enumString(childrenValues)),
    minHeightCm: nullable({ type: "integer", minimum: 100, maximum: 250 }),
    maxHeightCm: nullable({ type: "integer", minimum: 100, maximum: 250 }),
    education: nullable(str(80)),
    religion: nullable(str(80)),
    hometown: nullable(str(100)),
    datingGoal: nullable(
      enumString(["relationship", "friendship", "casual", "unsure"])
    ),
  },
  []
);
export const profilePatch = object(
  {
    displayName: str(80),
    dateOfBirth: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    gender: enumString(genders),
    bio: { type: "string", maxLength: 1000 },
    datingGoal: enumString(["relationship", "friendship", "casual", "unsure"]),
    interests: {
      type: "array",
      maxItems: 20,
      uniqueItems: true,
      items: str(40),
    },
    advanced: advancedProfile,
    lifestyle: object(
      {
        zodiac: nullable(str(30)),
        smoking: nullable(enumString([
          "never",
          "sometimes",
          "often",
          "prefer_not_to_say",
        ])),
        drinking: nullable(enumString([
          "never",
          "sometimes",
          "often",
          "prefer_not_to_say",
        ])),
      },
      []
    ),
  },
  []
);
export const preferencesPatch = object(
  {
    genders: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      uniqueItems: true,
      items: enumString(genders),
    },
    minAge: { type: "integer", minimum: 18, maximum: 100 },
    maxAge: { type: "integer", minimum: 18, maximum: 100 },
    radiusKm: { type: "number", minimum: 1, maximum: 1000 },
    advancedFilters,
  },
  []
);
export const coords = object({
  latitude: { type: "number", minimum: -90, maximum: 90 },
  longitude: { type: "number", minimum: -180, maximum: 180 },
});
export const messageBody = object(
  {
    clientMessageId: uuid,
    kind: enumString(["text", "gif", "sticker", "location"]),
    text: { type: "string", minLength: 1, maxLength: 2000 },
    payload: { type: "object" },
  },
  ["clientMessageId", "kind"]
);
