import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  object,
  str,
  uuid,
  enumString,
  profilePatch,
  preferencesPatch,
  coords,
  messageBody,
} from "../src/schemas.js";
import { firebaseExchangeSchema } from "../src/firestore/firebase-auth.js";
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const array = (items: any) => ({ type: "array", items });
const date = { type: "string", format: "date-time" };
const user = object({ id: uuid, displayName: str(80) });
const media = object({
  id: uuid,
  kind: enumString(["image"]),
  url: str(300),
  position: { type: "integer" },
});
const profileProps = {
  userId: uuid,
  displayName: str(80),
  age: { type: "integer" },
  gender: profilePatch.properties.gender,
  bio: { type: "string" },
  datingGoal: profilePatch.properties.datingGoal,
  interests: array(str(40)),
  // PATCH accepts per-field null to clear; profile responses omit cleared keys.
  lifestyle: object(
    Object.fromEntries(
      Object.entries(profilePatch.properties.lifestyle.properties).map(
        ([key, value]: [string, any]) => [key, value.anyOf[0]]
      )
    ),
    []
  ),
  advanced: profilePatch.properties.advanced,
  personality: { type: "null" },
  mood: { type: "null" },
  media: array(ref("Media")),
  verification: object({
    status: str(),
    mode: enumString(["demo", "real", "unavailable"]),
  }),
};
const schemas: Record<string, any> = {
  User: user,
  Media: media,
  PublicProfile: object(
    profileProps,
    Object.keys(profileProps)
  ),
  Profile: object(
    { ...profileProps, dateOfBirth: { type: "string", format: "date" } },
    Object.keys(profileProps)
  ),
  Session: object({ token: str(100), expiresAt: date, user: ref("User") }),
  FirebaseExchange: {
    ...firebaseExchangeSchema,
    properties: {
      idToken: { ...firebaseExchangeSchema.properties.idToken, writeOnly: true },
    },
  },
  GoogleSignInConfig: {
    oneOf: [
      object({ mode: { type: "string", const: "real" }, webClientId: str(300) }),
      object({ mode: { type: "string", const: "unavailable" }, reason: str(300) }),
    ],
  },
  AuthMethods: object({
    firebase: { oneOf: [
      object({ mode: { type: "string", const: "real" }, config: object({ apiKey: str(300), appId: str(300), authDomain: str(300), projectId: str(100) }) }),
      object({ mode: { type: "string", const: "unavailable" }, reason: str(300) }),
    ] },
    email: { oneOf: [object({ mode: { type: "string", const: "real" } }), object({ mode: { type: "string", const: "unavailable" }, reason: str(300) })] },
    google: ref("GoogleSignInConfig"),
  }),
  Preferences: object(preferencesPatch.properties),
  Match: object({
    id: uuid,
    otherUser: ref("User"),
    status: enumString(["active", "ended"]),
    createdAt: date,
  }),
  Message: object(
    {
      id: uuid,
      matchId: uuid,
      senderId: uuid,
      clientMessageId: uuid,
      kind: enumString(["text", "gif", "sticker", "location"]),
      text: str(2000),
      payload: { type: "object" },
      createdAt: date,
    },
    ["id", "matchId", "senderId", "clientMessageId", "kind", "createdAt"]
  ),
  Verification: object(
    {
      status: enumString(["not_submitted", "pending"]),
      mode: { const: "demo", type: "string" },
      submittedAt: date,
    },
    ["status", "mode"]
  ),
  Error: object({
    error: object(
      {
        code: str(),
        message: { type: "string" },
        fieldErrors: {
          type: "object",
          additionalProperties: { type: "string" },
        },
        requestId: str(),
      },
      ["code", "message", "requestId"]
    ),
  }),
};
const paths: Record<string, any> = {};
function route(
  method: string,
  path: string,
  summary: string,
  response: any,
  body?: any,
  options: {
    public?: boolean;
    multipart?: boolean;
    page?: boolean | "discovery";
    errors?: number[];
    requestExample?: unknown;
    responseExample?: unknown;
    operationId?: string;
    description?: string;
    retired?: boolean;
  } = {}
) {
  const parameters: any[] = [];
  for (const match of path.matchAll(/\{(\w+)\}/g))
    parameters.push({
      name: match[1],
      in: "path",
      required: true,
      schema: uuid,
    });
  if (options.page)
    parameters.push(
      {
        name: "limit",
        in: "query",
        schema: { type: "integer", minimum: 1, maximum: 50, default: 20 },
      },
      {
        name: "cursor",
        in: "query",
        schema: { type: "string" },
        description:
          "Cursor opaque do API trả về. Bỏ qua ở trang đầu; truyền nguyên meta.nextCursor để tải trang tiếp theo tới khi null.",
      }
    );
  const success = object({
    data: response,
    ...(options.page
      ? {
          meta: object(
            {
              nextCursor: { type: ["string", "null"] },
              ...(options.page === "discovery"
                ? {
                    radiusAvailable: { type: "boolean" },
                    reason: { type: "string" },
                    emptyReason: { type: "string" },
                    ownProfileComplete: { type: "boolean" },
                    missingRequirements: {
                      type: "array",
                      items: enumString([
                        "displayName",
                        "dateOfBirth",
                        "bio",
                        "media",
                      ]),
                    },
                  }
                : {}),
            },
            ["nextCursor"]
          ),
        }
      : {}),
  });
  paths[path] ??= {};
  const tag = tagFor(path);
  const operationId = options.operationId ?? operationIdFor(method, path);
  const errorStatuses = new Set([
    429,
    ...(options.public ? [] : [401]),
    ...(body ? [400] : []),
    ...(options.errors ?? []),
  ]);
  const responses: Record<string, any> = {};
  if (!options.retired) {
    responses["200"] = {
      description: "Thành công",
      content: {
        "application/json": {
          schema: success,
          ...(options.responseExample === undefined
            ? {}
            : { example: options.responseExample }),
        },
      },
    };
  }
  if (options.retired) errorStatuses.add(410);
  for (const code of [...errorStatuses].sort((a, b) => a - b)) {
    const [errorCode, message] = errorExampleFor(code);
    responses[String(code)] = {
      description: errorDescriptionFor(code),
      ...(code === 429
        ? { headers: { "Retry-After": { schema: { type: "string", example: "60" } } } }
        : {}),
      content: {
        "application/json": {
          schema: ref("Error"),
          example: {
            error: { code: errorCode, message, requestId: "req-example-001" },
          },
        },
      },
    };
  }
  paths[path][method] = {
    summary,
    operationId,
    tags: [tag],
    ...(options.retired ? { deprecated: true } : {}),
    ...(options.description ? { description: options.description } : {}),
    ...(options.public ? { security: [] } : {}),
    ...(parameters.length ? { parameters } : {}),
    ...(body
      ? {
          requestBody: {
            required: method !== "delete",
            content: {
              [options.multipart ? "multipart/form-data" : "application/json"]:
                {
                  schema: body,
                  ...(options.requestExample === undefined
                    ? {}
                    : { example: options.requestExample }),
                },
            },
          },
        }
      : {}),
    responses,
  };
}

function tagFor(path: string) {
  if (path === "/health" || path === "/v1/capabilities") return "Hệ thống";
  if (path.startsWith("/v1/demo/")) return "Tài khoản thử nghiệm";
  if (path.startsWith("/v1/auth/otp/")) return "Tài khoản thử nghiệm";
  if (path === "/v1/me") return "Xác thực";
  if (path.startsWith("/v1/auth/")) return "Xác thực";
  if (path.includes("verification") || path.includes("/media")) return "Hồ sơ và ảnh";
  if (path.includes("profile") || path.includes("preferences")) return "Hồ sơ và khám phá";
  if (path.includes("location") || path === "/v1/discovery") return "Vị trí và khám phá";
  if (path.includes("messages") || path.endsWith("/read") || path.includes("/chat/")) return "Trò chuyện";
  if (path.includes("swipes") || path.includes("matches")) return "Tương tác và Match";
  if (path.includes("blocks") || path.includes("reports")) return "An toàn";
  return "API";
}

function operationIdFor(method: string, path: string) {
  const suffix = path
    .split("/")
    .filter(Boolean)
    .map((segment) => segment.replace(/[{}:]/g, ""))
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join("");
  return `${method}${suffix}`;
}

function errorExampleFor(status: number): [string, string] {
  const examples: Record<number, [string, string]> = {
    400: ["VALIDATION_ERROR", "Dữ liệu yêu cầu không hợp lệ"],
    401: ["SESSION_EXPIRED", "Phiên đăng nhập không còn hiệu lực"],
    403: ["MATCH_INACTIVE", "Kết nối đã kết thúc"],
    404: ["NOT_FOUND", "Không tìm thấy tài nguyên"],
    409: ["MESSAGE_RETRY_CONFLICT", "Yêu cầu xung đột với dữ liệu đã ghi"],
    410: ["AUTH_SDK_REQUIRED", "Hãy dùng Firebase Authentication SDK"],
    413: ["UPLOAD_TOO_LARGE", "Tệp tải lên vượt giới hạn"],
    422: ["PROFILE_UNAVAILABLE", "Hồ sơ chưa đầy đủ hoặc không khả dụng"],
    429: ["RATE_LIMIT", "Quá nhiều yêu cầu"],
    503: ["PROVIDER_UNAVAILABLE", "Provider chưa khả dụng"],
  };
  return examples[status] ?? ["REQUEST_ERROR", "Yêu cầu không hoàn tất"];
}

function errorDescriptionFor(status: number) {
  const descriptions: Record<number, string> = {
    400: "Dữ liệu request không qua xác thực schema hoặc quy tắc đầu vào.",
    401: "Bearer session thiếu, hết hạn, bị thu hồi hoặc không hợp lệ.",
    403: "Session hợp lệ nhưng thao tác bị từ chối theo quyền/trạng thái.",
    404: "Tài nguyên không tồn tại hoặc không được tiết lộ cho người gọi.",
    409: "Yêu cầu xung đột với thao tác/dữ liệu đã ghi trước đó.",
    410: "Route xác thực cũ đã ngừng hỗ trợ.",
    413: "Request hoặc tệp multipart vượt giới hạn dung lượng.",
    422: "Request hợp lệ về cấu trúc nhưng không thỏa quy tắc nghiệp vụ.",
    429: "Vượt giới hạn tần suất; xem header Retry-After.",
    503: "Provider hoặc chế độ demo không khả dụng trong runtime hiện tại.",
  };
  return descriptions[status] ?? "API trả lỗi có cấu trúc.";
}
route(
  "get",
  "/health",
  "Kiểm tra tình trạng API và cơ sở dữ liệu",
  object({
    status: { const: "ok" },
    database: object({
      provider: { const: "firestore", type: "string" },
      mode: enumString(["cloud", "emulator"]),
      projectId: str(),
      namespace: str(48),
    }),
    version: str(),
  }),
  undefined,
  {
    public: true,
    responseExample: {
      data: {
        status: "ok",
        database: {
          provider: "firestore",
          mode: "cloud",
          projectId: "sample-project",
          namespace: "sample-app",
        },
        version: "0.2.0",
      },
    },
  }
);
route(
  "get",
  "/v1/capabilities",
  "Liệt kê chế độ hoạt động hiện tại của API và provider",
  array(
    object(
      {
        name: str(),
        mode: enumString(["real", "demo", "unavailable"]),
        reason: { type: "string" },
        provider: { const: "firestore", type: "string" },
        databaseMode: enumString(["cloud", "emulator"]),
        projectId: str(),
        namespace: str(48),
        storage: str(),
        notice: { type: "string" },
      },
      ["name", "mode"]
    )
  ),
  undefined,
  {
    public: true,
    description:
      "Mode phản ánh cấu hình runtime. `demo` là mô phỏng có nhãn; `unavailable` nghĩa là provider không hoạt động. Không xem capability là bằng chứng mọi account/provider đã được kiểm thử.",
  }
);
route(
  "get",
  "/v1/demo/accounts",
  "Liệt kê tài khoản hư cấu trong chế độ emulator demo",
  array(
    object({ account: enumString(["A", "B", "C", "D"]), displayName: str() })
  ),
  undefined,
  { public: true, errors: [404] }
);
route(
  "post",
  "/v1/demo/sessions",
  "Tạo session hư cấu để kiểm thử emulator",
  ref("Session"),
  object({ account: enumString(["A", "B", "C", "D"]) }),
  {
    public: true,
    errors: [404],
    requestExample: { account: "A" },
    description: "Chỉ hoạt động khi bật emulator/demo tường minh; cloud trả 404. Không dùng trong đăng nhập sản phẩm.",
  }
);
route(
  "post",
  "/v1/auth/otp/request",
  "Yêu cầu mã OTP mô phỏng trong emulator",
  object({
    challengeId: uuid,
    expiresAt: date,
    mode: { const: "demo" },
    demoCode: { type: "string", pattern: "^[0-9]{6}$" },
  }),
  object({ phone: { type: "string", pattern: "^\\+[1-9][0-9]{7,14}$" } }),
  {
    public: true,
    errors: [429, 503],
    requestExample: { phone: "+84912345678" },
    description: "Không gửi SMS. Chỉ chế độ emulator trả demoCode; cloud trả 503. Mã thử không xác minh quyền sở hữu số điện thoại.",
  }
);
route(
  "post",
  "/v1/auth/otp/verify",
  "Xác minh mã OTP mô phỏng trong emulator",
  ref("Session"),
  object({
    challengeId: uuid,
    code: { type: "string", pattern: "^[0-9]{6}$" },
  }),
  {
    public: true,
    errors: [400, 401, 503],
    requestExample: {
      challengeId: "00000000-0000-4000-8000-000000000001",
      code: "000000",
    },
    description: "Mã chỉ dùng trong emulator/demo; cloud không cấu hình SMS và trả 503. Response chứa session nên không có example token.",
  }
);
route(
  "get",
  "/v1/auth/methods",
  "Đọc cấu hình Firebase client và trạng thái phương thức xác thực",
  ref("AuthMethods"),
  undefined,
  {
    public: true,
    description: "Trả public client config nếu đã cấu hình và mode provider. Không trả Admin credential. `real` chỉ nghĩa là có cấu hình; không chứng minh đăng nhập tài khoản thật.",
  }
);
route(
  "post",
  "/v1/auth/firebase",
  "Đổi Firebase ID token hợp lệ thành API session",
  ref("Session"),
  ref("FirebaseExchange"),
  {
    public: true,
    errors: [401, 503],
    description: "App trước hết đăng nhập bằng Firebase Authentication SDK (email/password hoặc Google), sau đó gửi ID token tại đây. BE kiểm chữ ký, project, hạn dùng, revoke và trạng thái disabled; không nhận mật khẩu hoặc tự nối tài khoản theo email. Body chứa token được đánh dấu writeOnly; không có ví dụ token.",
  }
);
route(
  "get",
  "/v1/auth/google/config",
  "Đọc cấu hình công khai cho Google Sign-In",
  ref("GoogleSignInConfig"),
  undefined,
  {
    public: true,
    description: "`mode: real` nghĩa là adapter có cấu hình, không phải bằng chứng Google sign-in trên tài khoản/thiết bị thật.",
  }
);
for (const path of [
  "/v1/auth/register",
  "/v1/auth/login",
  "/v1/auth/google",
  "/v1/auth/google/challenge",
])
  route(
    "post",
    path,
    "Route xác thực cũ đã ngừng hỗ trợ",
    {},
    undefined,
    {
      public: true,
      retired: true,
      description: "Trả `410 AUTH_SDK_REQUIRED`. Dùng Firebase Authentication SDK rồi gọi `POST /v1/auth/firebase`; không gửi mật khẩu hoặc Google credential trực tiếp tới các route này.",
    }
  );
route(
  "post",
  "/v1/auth/logout",
  "Thu hồi session hiện tại và ngắt socket của session đó",
  object({ revoked: { const: true } }),
  undefined,
  { responseExample: { data: { revoked: true } } }
);
route("get", "/v1/me", "Đọc tài khoản hiện tại", ref("User"), undefined, {
  responseExample: {
    data: {
      id: "00000000-0000-4000-8000-000000000001",
      displayName: "Thành viên mẫu",
    },
  },
});
route(
  "get",
  "/v1/me/profile",
  "Đọc hồ sơ của chính mình",
  ref("Profile"),
  undefined,
  {
    responseExample: {
      data: {
        userId: "00000000-0000-4000-8000-000000000001",
        displayName: "Thành viên mẫu",
        dateOfBirth: "1995-05-15",
        age: 31,
        gender: "other",
        bio: "Thích cà phê và đi bộ.",
        datingGoal: "relationship",
        interests: ["coffee", "walking"],
        lifestyle: {},
        advanced: {
          children: null,
          heightCm: null,
          education: null,
          religion: null,
          hometown: null,
        },
        personality: null,
        mood: null,
        media: [],
        verification: { status: "not_submitted", mode: "demo" },
      },
    },
  }
);
route(
  "patch",
  "/v1/me/profile",
  "Cập nhật một phần hồ sơ; chỉ trường được gửi mới thay đổi",
  ref("Profile"),
  profilePatch,
  {
    errors: [404, 422],
    requestExample: {
      displayName: "Thành viên mẫu",
      bio: "Thích cà phê và đi bộ.",
      datingGoal: "relationship",
      interests: ["coffee", "walking"],
    },
    description: "Trường lifestyle bị lược khỏi body được giữ nguyên; gửi null để xóa giá trị lifestyle. Các trường advanced được merge. Ngày sinh phải hợp lệ và từ 18 tuổi.",
  }
);
route(
  "get",
  "/v1/profiles/{id}",
  "Đọc hồ sơ công khai đủ điều kiện",
  ref("PublicProfile"),
  undefined,
  {
    errors: [404],
    responseExample: {
      data: {
        userId: "00000000-0000-4000-8000-000000000002",
        displayName: "Thành viên mẫu",
        age: 29,
        gender: "female",
        bio: "Thích cà phê và đi bộ.",
        datingGoal: "relationship",
        interests: ["coffee", "walking"],
        lifestyle: {},
        advanced: {
          children: null,
          heightCm: null,
          education: null,
          religion: null,
          hometown: null,
        },
        personality: null,
        mood: null,
        media: [],
        verification: { status: "not_submitted", mode: "demo" },
      },
    },
    description: "Không trả ngày sinh đầy đủ, số điện thoại hay tọa độ. Hồ sơ ẩn, thiếu điều kiện, bị block hoặc không tồn tại đều trả 404.",
  }
);
const file = object({ file: { type: "string", format: "binary" } });
route(
  "post",
  "/v1/me/media",
  "Tải một ảnh hồ sơ JPEG, PNG hoặc WebP",
  ref("Media"),
  file,
  {
    multipart: true,
    errors: [404, 413, 422],
    description: "Chỉ nhận một multipart field `file`, tối đa 10 MB, xác thực chữ ký và MIME. Mỗi hồ sơ tối đa 9 ảnh (gồm upload đồng thời). Video hiện bị từ chối; media bytes lưu trên filesystem của BE.",
    responseExample: {
      data: {
        id: "00000000-0000-4000-8000-000000000003",
        kind: "image",
        url: "/v1/media/00000000-0000-4000-8000-000000000003/content",
        position: 0,
      },
    },
  }
);
route(
  "patch",
  "/v1/me/media/order",
  "Sắp xếp toàn bộ ảnh hồ sơ hiện có",
  array(ref("Media")),
  object({
    mediaIds: { type: "array", maxItems: 9, uniqueItems: true, items: uuid },
  }),
  {
    errors: [404, 422],
    requestExample: {
      mediaIds: ["00000000-0000-4000-8000-000000000003"],
    },
  }
);
route(
  "delete",
  "/v1/me/media/{id}",
  "Xóa ảnh hồ sơ của chính mình",
  object({ deleted: { const: true } }),
  undefined,
  {
    errors: [404],
    responseExample: { data: { deleted: true } },
  }
);
route(
  "get",
  "/v1/media/{id}/content",
  "Đọc bytes ảnh profile theo quyền truy cập",
  {},
  undefined,
  { errors: [404], description: "Ảnh trả về dạng binary với `Cache-Control: private, no-store`. Chủ ảnh xem được ảnh của mình; người khác chỉ xem ảnh profile đang công khai và đủ điều kiện. Block/cặp đã kết thúc bị ẩn bằng 404." }
);
paths["/v1/media/{id}/content"].get.responses["200"] = {
  description: "Bytes ảnh riêng tư; Cache-Control: private, no-store.",
  content: {
    "image/png": { schema: { type: "string", format: "binary" } },
    "image/jpeg": { schema: { type: "string", format: "binary" } },
    "image/webp": { schema: { type: "string", format: "binary" } },
  },
};
route(
  "post",
  "/v1/me/verification/selfie",
  "Gửi selfie vào luồng xác minh mô phỏng",
  ref("Verification"),
  file,
  { multipart: true, errors: [404, 413, 422, 503], description: "Chỉ chế độ emulator/demo nhận ảnh và đặt trạng thái pending. Không so khớp khuôn mặt, không tạo tích xanh thật; cloud trả 503." }
);
route(
  "get",
  "/v1/me/verification",
  "Đọc trạng thái selfie mô phỏng",
  ref("Verification"),
  undefined,
  { errors: [404, 503], description: "Chỉ có ở emulator/demo; cloud trả 503 vì provider xác minh selfie chưa khả dụng." }
);
route("get", "/v1/me/preferences", "Đọc bộ lọc khám phá của mình", ref("Preferences"));
route(
  "patch",
  "/v1/me/preferences",
  "Cập nhật bộ lọc khám phá",
  ref("Preferences"),
  preferencesPatch,
  {
    errors: [422],
    requestExample: {
      genders: ["female", "male"],
      minAge: 25,
      maxAge: 35,
      radiusKm: 50,
      advancedFilters: {},
    },
    description: "`minAge` không được lớn hơn `maxAge`; khoảng chiều cao cũng phải hợp lệ.",
  }
);
route(
  "get",
  "/v1/me/location",
  "Đọc trạng thái vị trí đã lưu của mình",
  object({
      hasLocation: { type: "boolean" },
      updatedAt: { type: ["string", "null"], format: "date-time" },
    }),
  undefined,
  { responseExample: { data: { hasLocation: true, updatedAt: "2026-11-03T03:00:00.000Z" } }, description: "Chỉ trả trạng thái và thời điểm cập nhật, không trả tọa độ." }
);
route(
  "put",
  "/v1/me/location",
  "Lưu tọa độ riêng của mình sau khi đồng ý",
  object({ consent: { const: true }, updatedAt: date }),
  object({ ...coords.properties, consent: { type: "boolean", const: true } }),
  {
    requestExample: { latitude: 10.775, longitude: 106.701, consent: true },
    responseExample: { data: { consent: true, updatedAt: "2026-11-03T03:00:00.000Z" } },
    description: "Chỉ chấp nhận `consent: true`. Tọa độ không nằm trong hồ sơ công khai.",
  }
);
route(
  "delete",
  "/v1/me/location",
  "Xóa vị trí riêng đã lưu",
  object({ consent: { const: false } }),
  undefined,
  { responseExample: { data: { consent: false } } }
);
route(
  "get",
  "/v1/discovery",
  "Lấy trang hồ sơ đủ điều kiện để khám phá",
  array(ref("PublicProfile")),
  undefined,
  { page: "discovery", description: "Server áp dụng giới tính/tuổi, hồ sơ đủ điều kiện, block, swipe và vị trí đã consent. `meta.radiusAvailable`/`reason` giải thích khi bán kính chưa áp dụng; `meta.ownProfileComplete`/`missingRequirements` báo trạng thái hồ sơ của chính người gọi. Không trả tọa độ đối phương." }
);
route(
  "post",
  "/v1/swipes",
  "Like hoặc Pass một hồ sơ",
  object({ swipeId: uuid, match: { anyOf: [ref("Match"), { type: "null" }] } }),
  object({ targetUserId: uuid, action: enumString(["like", "pass"]) }),
  {
    errors: [404, 409, 422],
    requestExample: { targetUserId: "00000000-0000-4000-8000-000000000002", action: "like" },
    responseExample: {
      data: {
        swipeId: "00000000-0000-4000-8000-000000000004",
        match: null,
      },
    },
    description: "Match chỉ tạo khi hai bên Like. Retry không tạo interaction thứ hai; cặp ended không tự Match lại. Trả 422 `PROFILE_INCOMPLETE` nếu hồ sơ của bạn chưa đủ điều kiện và 422 `PROFILE_UNAVAILABLE` nếu hồ sơ đối phương không khả dụng.",
  }
);
route("get", "/v1/matches", "Lấy danh sách Match đang hoạt động", array(ref("Match")), undefined, { page: true });
route(
  "delete",
  "/v1/matches/{id}",
  "Kết thúc Match",
  object({ ended: { const: true } }),
  object({ reasonCode: str(80) }, []),
  { errors: [400, 403, 404], requestExample: { reasonCode: "not_a_fit" }, responseExample: { data: { ended: true } }, description: "Body tùy chọn. Thu hồi quyền đọc/gửi chat và rời socket room ngay; lý do không hiện cho người còn lại." }
);
route(
  "get",
  "/v1/matches/{id}/messages",
  "Đọc lịch sử tin nhắn tăng dần của Match đang hoạt động",
  array(ref("Message")),
  undefined,
  { page: true, errors: [403, 404] }
);
route(
  "post",
  "/v1/matches/{id}/messages",
  "Gửi tin nhắn văn bản, vị trí hoặc mục catalog demo",
  ref("Message"),
  messageBody,
  {
    errors: [403, 404, 409, 503],
    requestExample: {
      clientMessageId: "00000000-0000-4000-8000-000000000005",
      kind: "text",
      text: "Cuối tuần bạn có muốn đi cà phê không?",
    },
    responseExample: {
      data: {
        id: "00000000-0000-4000-8000-000000000006",
        matchId: "00000000-0000-4000-8000-000000000007",
        senderId: "00000000-0000-4000-8000-000000000001",
        clientMessageId: "00000000-0000-4000-8000-000000000005",
        kind: "text",
        text: "Cuối tuần bạn có muốn đi cà phê không?",
        createdAt: "2026-11-03T03:00:00.000Z",
      },
    },
    description: "REST ghi tin nhắn. Cùng `clientMessageId` và cùng nội dung retry trả lại tin cũ; đổi nội dung trả 409. GIF/sticker chỉ từ catalog demo; cloud trả 503. Location là tọa độ do chính người gửi chủ động chia sẻ.",
  }
);
route(
  "post",
  "/v1/matches/{id}/read",
  "Cập nhật read cursor của mình",
  object({ read: { const: true } }),
  object({ messageId: uuid }, []),
  { errors: [403, 404], description: "Chỉ thành viên Match đang hoạt động được cập nhật; `messageId` nếu có phải thuộc Match này." }
);
route(
  "get",
  "/v1/chat/catalog",
  "Đọc catalog GIF/sticker thử nghiệm",
  object({ gifs: array(str()), stickers: array(str()) }),
  undefined,
  { errors: [503], description: "Catalog hư cấu chỉ trong emulator/demo; cloud trả 503 vì chưa cấu hình provider GIF/sticker thật." }
);
route(
  "post",
  "/v1/blocks",
  "Chặn một người dùng",
  object({ blocked: { const: true } }),
  object({ targetUserId: uuid }),
  { errors: [404, 422], requestExample: { targetUserId: "00000000-0000-4000-8000-000000000002" }, responseExample: { data: { blocked: true } }, description: "Block ẩn hai chiều trong discovery và kết thúc Match đang hoạt động; thu hồi quyền chat/socket." }
);
route(
  "delete",
  "/v1/blocks/{userId}",
  "Bỏ chặn một người dùng",
  object({ blocked: { const: false } }),
  undefined,
  { responseExample: { data: { blocked: false } }, description: "Bỏ chặn không khôi phục Match đã kết thúc." }
);
route(
  "get",
  "/v1/blocks",
  "Lấy danh sách người mình đã chặn",
  array(object({ targetUserId: uuid, createdAt: date })),
  undefined,
  { page: true }
);
route(
  "post",
  "/v1/reports",
  "Gửi báo cáo về một người dùng",
  object({ id: uuid, status: { const: "received" } }),
  object(
    {
      targetUserId: uuid,
      reasonCode: str(80),
      detail: { type: "string", maxLength: 2000 },
      matchId: uuid,
    },
    ["targetUserId", "reasonCode"]
  ),
  {
    errors: [404, 422],
    requestExample: {
      targetUserId: "00000000-0000-4000-8000-000000000002",
      reasonCode: "uncomfortable",
      detail: "Hành vi khiến tôi không thoải mái.",
    },
    responseExample: {
      data: {
        id: "00000000-0000-4000-8000-000000000008",
        status: "received",
      },
    },
    description: "Tạo biên nhận report riêng tư. API hiện chưa có route review/moderation; report không tự động ban tài khoản.",
  }
);
const spec = {
  openapi: "3.1.0",
  info: {
    title: "Gặp API — Firestore core",
    version: "0.2.0",
    description:
      "API hiện thực P01–P05 bằng Cloud Firestore. Dữ liệu demo chỉ hoạt động khi bật emulator rõ ràng. Các thao tác tạo mới và retry idempotent thành công trả HTTP 200. Client đăng nhập bằng Firebase Authentication SDK rồi đổi Firebase ID token lấy API session opaque; API không nhận mật khẩu. Email chưa được xác minh quyền sở hữu. OTP/SMS, xác minh selfie và catalog GIF/sticker chỉ mô phỏng trong emulator hoặc không khả dụng ở cloud. Bytes ảnh nằm trên filesystem của máy chạy BE, không đồng bộ chỉ nhờ Firestore.",
  },
  servers: [{ url: "/", description: "Cùng origin với API đang chạy" }],
  tags: [
    { name: "Hệ thống", description: "Health và khả năng của runtime hiện tại." },
    { name: "Tài khoản thử nghiệm", description: "Tài khoản giả; chỉ bật trong emulator/demo tường minh." },
    { name: "Xác thực", description: "Firebase SDK và session API; không gửi mật khẩu tới API." },
    { name: "Hồ sơ và ảnh", description: "Hồ sơ, ảnh và trạng thái xác minh mô phỏng." },
    { name: "Hồ sơ và khám phá", description: "Hồ sơ cá nhân, hồ sơ công khai và bộ lọc." },
    { name: "Vị trí và khám phá", description: "Consent vị trí riêng và trang discovery." },
    { name: "Tương tác và Match", description: "Swipe và vòng đời Match." },
    { name: "Trò chuyện", description: "Tin nhắn REST và catalog thử nghiệm." },
    { name: "An toàn", description: "Block và tiếp nhận report; chưa có moderation API." },
  ],
  security: [{ bearerAuth: [] }],
  paths,
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        description:
          "API session opaque do POST /v1/auth/firebase trả về. Chỉ hash của session được lưu trong Firestore; mặc định 24 giờ và có thể thu hồi bằng logout. Đây không phải Firebase ID token.",
      },
    },
    schemas,
  },
};
const target = resolve(
  import.meta.dirname,
  "../../..",
  "docs/api/openapi.yaml"
);
mkdirSync(resolve(target, ".."), { recursive: true });
writeFileSync(target, JSON.stringify(spec, null, 2) + "\n");
