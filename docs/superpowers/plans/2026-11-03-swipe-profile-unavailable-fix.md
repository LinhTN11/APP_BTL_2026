# Sửa lỗi nhấn Thích báo "Hồ sơ chưa đầy đủ hoặc không khả dụng" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phân biệt rõ lỗi hồ sơ của chính người dùng chưa hoàn thiện (`PROFILE_INCOMPLETE`) với hồ sơ đối phương không khả dụng (`PROFILE_UNAVAILABLE`), sửa lỗi tính tuổi khi `dateOfBirth` rỗng/null, trả trạng thái hoàn thiện hồ sơ của người gọi ngay trong `GET /v1/discovery`, và hướng dẫn người dùng chuyển sang tab `Tôi` hoàn thiện hồ sơ trước khi nhấn Thích/Bỏ qua.

**Architecture:** Giữ nguyên kiến trúc RN Community CLI → Fastify → Cloud Firestore Admin SDK. Integrator khóa contract (`DiscoveryMeta` mở rộng `ownProfileComplete` và `missingRequirements`, phân tách mã lỗi 422 `PROFILE_INCOMPLETE` / `PROFILE_UNAVAILABLE`). Hai subagent (`Model: "flash"`) thực thi song song theo file ownership tách biệt: Worker 1 xử lý BE (`context.ts`, `matching.ts`, tests Firestore) và Worker 2 xử lý FE (`Discover.tsx`, tests mobile).

**Tech Stack:** TypeScript, React Native Community CLI, Fastify, Firebase Admin SDK (Cloud Firestore), Node test runner, Jest / React Test Renderer.

**Spec:** Yêu cầu USER (03/11/2026): *"lên kế hoạch fix lỗi khi nhấn thích bị báo hồ sơ chưa đầy đủ hoạc không khả dụng - chia cho subagent gemini 3.8 flash hight thực thi"*; `AGENTS.md`, `docs/backend/README.md`, `docs/backend/requirements.md` (F06/F07, T03.01/T03.02/T05.01), `docs/06-quy-tac-ai-va-subagent.md`, `docs/08-hop-dong-api-va-du-lieu.md`.

## Global Constraints

- React Native Community CLI bắt buộc, không dùng Expo hay module `expo-*`, Android chính.
- Cloud Firestore qua Admin SDK là DB chính; không tự ghi/sửa/xóa/seed dữ liệu trên cloud DB của team. Kiểm thử tự động chạy trên Firestore Emulator được chọn rõ.
- Không lộ tọa độ GPS, ngày sinh đầy đủ hoặc lý do nội bộ nhạy cảm (như ai đã block ai) của đối phương.
- Tối đa 2 worker subagent đồng thời, dùng model `flash` theo yêu cầu USER; Integrator giữ các file contract dùng chung (`packages/contracts/src/index.ts`, `apps/mobile/src/api.ts`, `apps/api/scripts/generate-openapi.ts`, `docs/api/openapi.yaml`).

---

## Chẩn đoán nguyên nhân gốc (Read-only Cloud & Code Audit — 03/11/2026)

1. **Dữ liệu thực tế trên Cloud Firestore (`app-cuoi-ky`, chỉ đọc, không ghi):**
   - Hiện có 3 tài khoản `active` ở khoảng cách ~0 km (`2029dd15`, `5aa92179`, `6098fc9d`).
   - Hai tài khoản `5aa92179` (22 tuổi, có tên, bio, 1 ảnh) và `6098fc9d` (21 tuổi, có tên, bio, 2 ảnh) đã đủ hồ sơ; `6098fc9d` đã nhấn Like `5aa92179` thành công.
   - Tài khoản thứ ba `2029dd15` (26 tuổi, đã có tên và ngày sinh) **chưa có giới thiệu (`bio: ""`) và chưa có ảnh (`mediaIds: []`)**.
2. **Lỗi ở Backend (`apps/api/src/firestore/matching.ts`, `context.ts`):**
   - `GET /v1/discovery` trả danh sách ứng viên (`5aa92179`, `6098fc9d`) cho `2029dd15` nhưng không báo cho client biết hồ sơ của chính `req.actor` chưa hoàn thiện.
   - Khi `2029dd15` nhấn **Thích**, `POST /v1/swipes` kiểm tra gộp `!complete(ctx, ownProfile) || !complete(ctx, targetProfile) || block || reverseBlock` và trả chung một lỗi mơ hồ `422 PROFILE_UNAVAILABLE: "Hồ sơ chưa đầy đủ hoặc không khả dụng"`, khiến người dùng không biết hồ sơ của chính mình thiếu bio/ảnh hay hồ sơ đối phương bị lỗi.
   - Trong `context.ts` (`age(dob)`) và `matching.ts` (`complete(ctx, profile)`), biểu thức `ctx.age(profile.dateOfBirth ?? "") >= 18` tính `Number("".slice(0, 4)) === 0` nên trả tuổi `2026 >= 18` (`true`) khi `dateOfBirth` là `null` hoặc `""`. Nếu tài khoản mới thêm bio + ảnh trước khi lưu ngày sinh, `complete()` trả `true` sai và làm `GET /v1/discovery` lỗi `TypeError` tại `ctx.age(profile!.dateOfBirth)`.
   - `POST /v1/swipes` chưa kiểm tra `targetProfile.visibility !== "public"` khi đối phương đã ẩn hồ sơ sau khi deck được tải.
3. **Lỗi UX ở Frontend (`apps/mobile/src/screens/Discover.tsx`):**
   - Màn `Khám phá` hiển thị thẻ ứng viên với nút **Thích** / **Bỏ qua** đang bật cho cả tài khoản chưa hoàn thiện hồ sơ của chính mình, không có cảnh báo các mục còn thiếu hoặc nút chuyển nhanh sang tab `Tôi`.
   - Khi `POST /v1/swipes` trả lỗi 422 do hồ sơ đối phương không còn khả dụng (`PROFILE_UNAVAILABLE`), thẻ ứng viên cũ không được loại khỏi danh sách tạm trên màn hình.

---

## Contract dùng chung (Integrator khóa trước khi giao subagent)

**Files do Integrator cập nhật:**
- `packages/contracts/src/index.ts`
- `apps/mobile/src/api.ts`

```ts
export type ProfileRequirement = "displayName" | "dateOfBirth" | "bio" | "media";

export interface DiscoveryMeta {
  nextCursor: string | null;
  radiusAvailable?: boolean;
  reason?: string;
  ownProfileComplete?: boolean;
  missingRequirements?: ProfileRequirement[];
}
```

- `GET /v1/discovery`: `meta` trả thêm `ownProfileComplete: boolean` và `missingRequirements: ProfileRequirement[]` (tận dụng lệnh `ctx.db.getAll` sẵn có, không phát sinh thêm round-trip).
- `POST /v1/swipes`:
  - Nếu hồ sơ của `req.actor` chưa đủ điều kiện (`!ctx.availableUser(ownUser)` hoặc thiếu `displayName` / `dateOfBirth` 18+ / `bio` / `media`): trả `422` với `code: "PROFILE_INCOMPLETE"` và thông báo tiếng Việt nêu rõ các mục hồ sơ của bạn còn thiếu.
  - Nếu hồ sơ đối phương không khả dụng (`block`, `reverseBlock`, `!complete(ctx, targetProfile)`, hoặc `targetProfile.visibility !== "public"`): trả `422` với `code: "PROFILE_UNAVAILABLE"` và thông báo `"Hồ sơ đối phương hiện không khả dụng hoặc chưa đầy đủ"`.

---

### Task 1: Worker BE — Sửa kiểm tra hoàn thiện hồ sơ, tách lỗi swipe và trả trạng thái ở Discovery

**Mapping/Owner:** T03.01 / T03.02 (F06, F07), BE domain (`Model: "flash"`).

**Files:**
- Modify: `apps/api/src/firestore/context.ts`
- Modify: `apps/api/src/firestore/matching.ts`
- Test: `apps/api/test/firestore-auth-profile.test.ts`
- Test: `apps/api/test/firestore-interaction.test.ts`

**Interfaces:**
- Consumes: `FirestoreContext` (`apps/api/src/firestore/context.ts`), `ProfileRequirement`
- Produces:
  - `ctx.age(dob: unknown): number` trả `0` nếu `dob` không phải chuỗi `YYYY-MM-DD` hợp lệ.
  - `missingProfileRequirements(ctx: FirestoreContext, profile: DocumentData | undefined): ("displayName" | "dateOfBirth" | "bio" | "media")[]` trong `apps/api/src/firestore/matching.ts`.
  - `GET /v1/discovery` trả `meta.ownProfileComplete` và `meta.missingRequirements`.
  - `POST /v1/swipes` trả `422 PROFILE_INCOMPLETE` khi hồ sơ người gọi thiếu điều kiện và `422 PROFILE_UNAVAILABLE` khi hồ sơ đối phương bị chặn/ẩn/thiếu điều kiện.

- [x] **Step 1: Viết test tái hiện lỗi trong `apps/api/test/firestore-auth-profile.test.ts` và `apps/api/test/firestore-interaction.test.ts`**

Trong `apps/api/test/firestore-auth-profile.test.ts` (bên trong test `"Firestore discovery: newly registered incomplete profiles appear only after bio and photo are saved"` sau khi `b` lưu bio còn `a` đang thiếu bio và ảnh, hoặc test riêng):
- Kiểm tra `discover(a.token)` trả `meta.ownProfileComplete === false` và `meta.missingRequirements` gồm `["bio", "media"]`.
- Kiểm tra khi `a` có `dateOfBirth: null`, `bio: "Có bio"`, và đã upload 1 ảnh: `discover(b.token)` không bị crash 500 và không trả `a` trong danh sách, đồng thời `discover(a.token)` báo `missingRequirements` chứa `"dateOfBirth"`.
- Kiểm tra khi `a` chưa hoàn thiện hồ sơ mà gọi `POST /v1/swipes` lên `demoIds.B`: trả HTTP `422`, `error.code === "PROFILE_INCOMPLETE"`, `error.message` chứa `"Hồ sơ của bạn chưa đầy đủ"`.
- Kiểm tra khi cả `a` và `b` đã đủ hồ sơ nhưng `b` đổi `visibility: "hidden"` hoặc xóa hết ảnh rồi `a` gọi `POST /v1/swipes` lên `demoIds.B`: trả HTTP `422`, `error.code === "PROFILE_UNAVAILABLE"`.

- [x] **Step 2: Sửa `age()` trong `apps/api/src/firestore/context.ts`**

```ts
  age(dob: unknown) {
    if (typeof dob !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return 0;
    const parsed = new Date(dob + "T00:00:00Z");
    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== dob
    )
      return 0;
    const now = new Date(this.config.now());
    return (
      now.getUTCFullYear() -
      Number(dob.slice(0, 4)) -
      (now.toISOString().slice(5, 10) < dob.slice(5) ? 1 : 0)
    );
  }
```

- [x] **Step 3: Cập nhật `apps/api/src/firestore/matching.ts`**

```ts
export type ProfileRequirement =
  | "displayName"
  | "dateOfBirth"
  | "bio"
  | "media";

export function missingProfileRequirements(
  ctx: FirestoreContext,
  profile: DocumentData | undefined
): ProfileRequirement[] {
  const missing: ProfileRequirement[] = [];
  if (!profile?.displayName?.trim()) missing.push("displayName");
  if (ctx.age(profile?.dateOfBirth) < 18) missing.push("dateOfBirth");
  if (!profile?.bio?.trim()) missing.push("bio");
  if (!(profile?.mediaIds?.length > 0)) missing.push("media");
  return missing;
}

const complete = (ctx: FirestoreContext, profile: DocumentData | undefined) =>
  !!profile && missingProfileRequirements(ctx, profile).length === 0;
```

Trong `GET /v1/discovery`:
- Đọc thêm `ctx.ref("profiles", req.actor)` trong `ctx.db.getAll`:
  ```ts
  const [preferenceDoc, locationDoc, ownProfileDoc] = await ctx.db.getAll(
    ctx.ref("preferences", req.actor),
    ctx.ref("locations", req.actor),
    ctx.ref("profiles", req.actor)
  );
  const ownMissing = missingProfileRequirements(ctx, ownProfileDoc.data());
  ```
- Bổ sung vào `meta`:
  ```ts
  ownProfileComplete: ownMissing.length === 0,
  missingRequirements: ownMissing,
  ```

Trong `POST /v1/swipes`:
- Thay khối kiểm tra `PROFILE_UNAVAILABLE` bằng:
  ```ts
  const ownMissing = missingProfileRequirements(ctx, ownProfile);
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
    !complete(ctx, targetProfile) ||
    targetProfile?.visibility !== "public"
  )
    fail(
      422,
      "PROFILE_UNAVAILABLE",
      "Hồ sơ đối phương hiện không khả dụng hoặc chưa đầy đủ"
    );
  ```

- [x] **Step 4: Chạy kiểm thử BE trên Firestore Emulator và typecheck**

Run:
- `npm run typecheck --workspace @gap/api`
- `npm run test:firestore`

Expected: Toàn bộ tests trong `firestore-*.test.ts` PASS, 0 fail, 0 skip.

---

### Task 2: Worker FE — Cảnh báo hồ sơ chưa đầy đủ trên màn Khám phá và xử lý lỗi khi nhấn Thích/Bỏ qua

**Mapping/Owner:** T03.02 / T05.01 (F06, F07), FE-test/core (`Model: "flash"`).

**Files:**
- Modify: `apps/mobile/src/screens/Discover.tsx`
- Test: `apps/mobile/__tests__/screens.test.tsx`

**Interfaces:**
- Consumes: `Envelope<Profile[]>["meta"]` (`ownProfileComplete`, `missingRequirements`), `ApiError` (`code: "PROFILE_INCOMPLETE" | "PROFILE_UNAVAILABLE"`), prop `onEditProfile?: () => void`
- Produces:
  - Khi `meta.ownProfileComplete === false` hoặc khi `POST /v1/swipes` trả `PROFILE_INCOMPLETE`: hiển thị `Panel` liệt kê các mục hồ sơ của bạn còn thiếu + nút `"Hoàn thiện hồ sơ của tôi"` (gọi `onEditProfile`), đồng thời khóa nút `"Thích"` và `"Bỏ qua"` cho tới khi hồ sơ được hoàn thiện/tải lại.
  - Khi `POST /v1/swipes` trả `PROFILE_UNAVAILABLE`, `MATCH_ENDED` hoặc `404`: loại bỏ thẻ ứng viên không còn khả dụng khỏi danh sách `profiles` trên màn hình để người dùng tiếp tục với ứng viên kế tiếp.
  - Giữ nguyên thứ tự gọi API `['/v1/me/preferences', '/v1/me/location', '/v1/discovery?limit=10']` để tương thích 100% với bộ test vị trí hiện có.

- [x] **Step 1: Viết test trong `apps/mobile/__tests__/screens.test.tsx`**

Thêm các test:
1. Khi `/v1/discovery` trả `meta: { ownProfileComplete: false, missingRequirements: ['bio', 'media'], nextCursor: null }`:
   - Hiển thị nhắc nhở hoàn thiện hồ sơ (`Viết và lưu phần Giới thiệu`, `Thêm ít nhất một ảnh hồ sơ`).
   - Nút `"Thích"` và `"Bỏ qua"` đều `disabled === true`.
   - Nhấn `"Hoàn thiện hồ sơ của tôi"` gọi `onEditProfile`.
2. Khi `/v1/discovery` chưa báo `ownProfileComplete: false` nhưng nhấn `"Thích"` gặp `ApiError(422, 'PROFILE_INCOMPLETE', 'Hồ sơ của bạn chưa đầy đủ (thiếu phần giới thiệu, ít nhất 1 ảnh hồ sơ).')`:
   - Hiển thị thông báo lỗi và mở `Panel` hướng dẫn kèm nút `"Hoàn thiện hồ sơ của tôi"`, giữ nguyên thẻ ứng viên.
3. Khi nhấn `"Thích"` gặp `ApiError(422, 'PROFILE_UNAVAILABLE', 'Hồ sơ đối phương hiện không khả dụng hoặc chưa đầy đủ')`:
   - Hiển thị thông báo lỗi và loại bỏ thẻ ứng viên không khả dụng khỏi danh sách để chuyển sang hồ sơ tiếp theo.

- [x] **Step 2: Cập nhật `apps/mobile/src/screens/Discover.tsx`**

- Thêm state:
  ```ts
  const [ownProfileComplete, setOwnProfileComplete] = useState(true);
  const [missingRequirements, setMissingRequirements] = useState<ProfileRequirement[]>([]);
  ```
- Trong `load()`:
  ```ts
  setOwnProfileComplete(result.meta?.ownProfileComplete !== false);
  setMissingRequirements(result.meta?.missingRequirements ?? []);
  ```
- Trong `swipe(action)`:
  ```ts
  const swipe = (action: 'like' | 'pass') =>
    task.run(async () => {
      const requestEpoch = epoch.current;
      const targetId = profile.userId;
      try {
        const result = await api.request<{ match: Match | null }>(
          '/v1/swipes',
          'POST',
          { targetUserId: targetId, action },
        );
        if (requestEpoch !== epoch.current) { return; }
        setProfiles(value => value.filter(item => item.userId !== targetId));
        if (result.data.match) {
          onMatch(result.data.match);
        } else {
          task.setNotice(
            action === 'like'
              ? 'Đã ghi lượt thích. Chỉ ghép đôi khi người kia cũng thích bạn.'
              : 'Đã bỏ qua hồ sơ.',
          );
        }
      } catch (error) {
        if (requestEpoch === epoch.current && error instanceof ApiError) {
          if (error.code === 'PROFILE_INCOMPLETE') {
            setOwnProfileComplete(false);
          } else if (
            error.code === 'PROFILE_UNAVAILABLE' ||
            error.code === 'MATCH_ENDED' ||
            error.status === 404
          ) {
            setProfiles(value => value.filter(item => item.userId !== targetId));
          }
        }
        throw error;
      }
    });
  ```
- Hiển thị `Panel` khi `!ownProfileComplete` với danh sách mục thiếu và nút `"Hoàn thiện hồ sơ của tôi"` (nếu có `onEditProfile`), và đặt `disabled={task.busy || !ownProfileComplete}` trên hai nút `"Bỏ qua"` / `"Thích"`.

- [x] **Step 3: Chạy kiểm thử Mobile và typecheck**

Run:
- `npm test --workspace @gap/mobile -- --runInBand screens.test.tsx discovery-location.test.tsx`
- `npm run typecheck --workspace @gap/mobile`

Expected: Tất cả test suites trong `screens.test.tsx` và `discovery-location.test.tsx` PASS.

---

### Task 3: Integrator — Đồng bộ OpenAPI, tài liệu, review chéo và chạy verification toàn cục

**Mapping/Owner:** T00.03 / T03.02 / T11.02, Integrator.

**Files:**
- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/mobile/src/api.ts`
- Modify: `apps/api/scripts/generate-openapi.ts`
- Modify: `docs/api/openapi.yaml`
- Modify: `docs/api/firestore-interaction.md`

- [x] **Step 1: Cập nhật `generate-openapi.ts` và sinh lại `docs/api/openapi.yaml` (`npm run api:docs`)**
- [x] **Step 2: Review diff của cả hai subagent (`git diff`) bảo đảm không vi phạm ranh giới file, không rò rỉ dữ liệu nhạy cảm**
- [x] **Step 3: Chạy kiểm chứng toàn bộ (`npm run typecheck`, `npm run lint`, `npm run test:openapi`, `npm run test:firestore`, `npm run test:mobile`, `npm run security:check`)**

