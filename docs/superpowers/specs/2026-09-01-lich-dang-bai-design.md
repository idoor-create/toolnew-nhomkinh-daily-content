# Hệ thống quản lý lịch đăng bài — Facebook & TikTok

**Ngày:** 2026-09-01  
**Trạng thái:** Spec đã chốt hướng; chờ duyệt trước khi viết plan implementation  
**Phạm vi tài liệu:** Workflow toàn hệ thống (đã rà soát) + thiết kế chi tiết **Phase 1**

---

## 1. Quyết định đã chốt

| Mục | Quyết định |
|-----|------------|
| Người dùng | Agency nội bộ: nhân viên đăng nhập, quản lý nhiều khách hàng |
| Stack Phase 1 | Node.js, Express, TypeScript, Prisma, SQLite, JWT |
| Đổi DB sau | Prisma schema giữ gần Postgres; migrate khi cần |
| Phase 1 | `users` + `customers` + `posts`; seed 1 admin; chưa upload, chưa scheduler, chưa OAuth thật |
| Kênh đăng | Facebook Graph API chính thức + TikTok qua Ayrshare (hoặc Buffer) |
| Không làm | Puppeteer / giả lập đăng nhập Facebook hoặc TikTok |

---

## 2. Nguyên tắc an toàn (bắt buộc)

- Không tự động hóa trình duyệt để đăng nhập hay đăng bài.
- Facebook: OAuth + Graph API, đúng quyền, chấp nhận App Review.
- TikTok SME: không có Content Posting API công khai ổn định cho mọi app; dùng đối tác được cấp phép (Ayrshare/Buffer). Mật khẩu TikTok của khách **không** lưu trên hệ thống này — khách kết nối TikTok trên dashboard Ayrshare/Buffer.
- Token Facebook và Ayrshare profile key lưu mã hóa (Phase 3+); Phase 1 chưa nhận token thật.

---

## 3. Workflow tổng quát (đã rà)

Luồng thật tế gồm **onboarding (1 lần / khách)** rồi **vòng đời bài viết**. Phase 1 chỉ làm vòng đời bài ở mức lưu DB + API; chưa kích hoạt đăng.

```
BƯỚC 0 — ONBOARDING (1 lần / khách, Phase 2–3)
  Nhân viên tạo customer trên app
  → Gửi khách Facebook Login (OAuth) cấp quyền Page
  → Khách tạo/kết nối Ayrshare (TikTok) → đưa Profile Key cho agency
  → Backend lưu page_id + token (mã hóa) + ayrshare_profile_key (mã hóa)

BƯỚC 1 — TẠO BÀI (Phase 1: API; Phase 4: UI calendar)
  Nhân viên chọn customer, nội dung, hashtag, URL media, platform, giờ đăng
  → Validate: TikTok bắt buộc có video URL; caption TikTok ngắn hơn FB
  → Lưu posts (draft hoặc scheduled)

BƯỚC 2 — LÊN LỊCH (Phase 5)
  status = scheduled
  → Đăng ký delayed job (BullMQ + Redis khi scale; node-schedule chỉ khi rất ít job)

BƯỚC 3 — ĐẾN GIỜ: PUBLISH (Phase 2–3 + 5)
  Promise.allSettled:
    Facebook → Graph API (feed / photos / videos)
    TikTok   → Ayrshare POST /post, platforms: ["tiktok"]
  Một kênh lỗi không chặn kênh kia.

BƯỚC 4 — LOG (Phase 5)
  Mỗi platform một dòng post_logs
  Thành công: external_post_id, external_url
  Thất bại: error_message, status post = failed nếu mọi kênh fail;
            partial nếu một kênh ok một kênh fail (xem mục 6)

BƯỚC 5 — THÔNG BÁO (Phase 5+)
  Dashboard (bắt buộc) + email (tuỳ chọn)
  Token hết hạn → trạng thái customer cần reconnect
```

### 3.1 Sửa so với bản workflow gốc

| Gốc | Chuẩn lại |
|-----|-----------|
| `status` chỉ draft/scheduled/published/failed | Thêm `partial` khi đăng nhiều kênh, một kênh fail |
| Scheduler ngay khi lưu scheduled | Phase 1 **chỉ lưu** `scheduled_time` + `status`; job tạo ở Phase 5. Tránh job “ma” khi CRUD sửa giờ/xóa bài |
| `platforms` / `media_urls` TEXT JSON | Prisma `Json` (SQLite vẫn hỗ trợ); Postgres sau không đổi model |
| Token trên `customers` plain TEXT | Phase 1: cột tồn tại, để trống; Phase 2+: mã hóa at-rest |
| Upload Cloudinary trong bước tạo bài | Phase 1: `media_urls` do client gửi sẵn; upload Phase 4 |
| Webhook Ayrshare | Phase 3+; Phase 1 không có `/api/webhooks` |
| Auth chỉ JWT, chưa nói user | Bảng `users` (nhân viên agency), bcrypt, JWT access token |

### 3.2 Facebook — luồng kỹ thuật (Phase 2, không code ở Phase 1)

1. Meta App + Facebook Login.
2. Quyền tối thiểu cần xin review: `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`. (Tên quyền lấy theo docs Meta tại thời điểm implement.)
3. User token ngắn hạn → long-lived user token → Page access token (long-lived). Lưu page token, không lưu mật khẩu user.
4. Job định kỳ refresh trước khi hết hạn; fail → `customers.facebook_reconnect_required = true`.
5. Publish:
   - Chỉ text: `POST /{page-id}/feed`
   - Ảnh: `POST /{page-id}/photos` (hoặc đính kèm URL)
   - Video: `POST /{page-id}/videos` (hoặc upload chunk theo docs)
6. App Review 1–2 tuần: xin song song lúc làm Phase 1–4; dev mode chỉ Page do role app.

### 3.3 TikTok qua Ayrshare (Phase 3)

1. Khách kết nối TikTok trên Ayrshare; agency lưu `profileKey`.
2. `POST https://api.ayrshare.com/api/post` với media video, caption, `platforms: ["tiktok"]`, `profileKeys`.
3. Validate trước khi schedule: có ít nhất một URL video; cảnh báo duration/format theo giới hạn Ayrshare/TikTok tại thời điểm code.
4. Không parse HTML TikTok, không cookie session.

---

## 4. Phase 1 — Mục tiêu và ranh giới

**Mục tiêu:** API nội bộ để nhân viên login, quản lý khách, tạo/sửa/xóa/lọc bài. Frontend calendar Phase 4 gắn vào các endpoint này.

**In scope**

- Project Express + TS + Prisma + SQLite
- Auth: login, `GET /me`, seed admin
- CRUD `customers` (metadata; token fields optional rỗng)
- CRUD `posts` gắn `customer_id`, `status` draft | scheduled
- Validation cơ bản: content bắt buộc; `scheduled` cần `scheduled_time`; TikTok trong `platforms` thì `media_urls` không rỗng (Phase 1 chưa phân biệt ảnh/video — ghi chú để Phase 4 siết)
- JWT trên mọi route trừ login

**Out of scope (cố ý)**

- Facebook OAuth, Graph publish, Ayrshare
- Cloudinary / multipart upload
- BullMQ, cron publish
- Email
- Refresh token rotation, 2FA, role phân quyền phức tạp (mọi user = staff)
- Register công khai (chỉ seed; thêm user bằng script/seed hoặc endpoint nội bộ sau)

**Tiêu chí xong Phase 1**

1. `npx prisma migrate` tạo DB; seed admin chạy được.
2. Login trả JWT; request không token → 401.
3. CRUD customer và post bằng HTTP (curl hoặc test).
4. Xóa customer bị chặn nếu còn post, hoặc cascade — **chọn: cấm xóa khi còn post** (an toàn hơn).
5. README: env, seed, cách gọi API.

---

## 5. Kiến trúc Phase 1

```
toolnew/
  prisma/
    schema.prisma
    seed.ts
  src/
    index.ts                 # listen
    app.ts                   # express app
    config.ts                # env
    middleware/auth.ts       # Bearer JWT
    middleware/error.ts
    lib/prisma.ts
    modules/
      auth/auth.routes.ts
      auth/auth.service.ts
      customers/customers.routes.ts
      customers/customers.service.ts
      posts/posts.routes.ts
      posts/posts.service.ts
  .env.example
  package.json
```

- REST + JWT (Bearer). Không session cookie ở Phase 1.
- Service chứa logic; route chỉ parse/validate/gọi service.
- Prisma Client một instance (`lib/prisma.ts`).
- Password: bcrypt. JWT payload: `{ sub: userId, email }`, hết hạn 7 ngày (đủ nội bộ; rút ngắn ở Phase sau nếu cần).

---

## 6. Data model (Prisma / SQLite)

### `User` (nhân viên)

| Field | Type | Ghi chú |
|-------|------|---------|
| id | Int PK | autoincrement |
| email | String unique | login |
| passwordHash | String | bcrypt |
| name | String | |
| createdAt | DateTime | |

### `Customer`

| Field | Type | Ghi chú |
|-------|------|---------|
| id | Int PK | |
| name | String | |
| facebookPageId | String? | Phase 2 |
| facebookToken | String? | Phase 2 mã hóa; Phase 1 không ghi từ API public nếu không cần |
| ayrshareProfileKey | String? | Phase 3 |
| facebookReconnectRequired | Boolean | default false |
| createdAt | DateTime | |

Phase 1: PATCH customer **không** nhận `facebookToken` / `ayrshareProfileKey` trên API công khai (tránh nhân viên dán secret vào log). Cột để sẵn; điền bằng script/env nội bộ hoặc Phase 2 OAuth.

### `Post`

| Field | Type | Ghi chú |
|-------|------|---------|
| id | Int PK | |
| customerId | Int FK | |
| title | String? | |
| content | String | bắt buộc |
| platforms | Json | `["facebook","tiktok"]` |
| mediaUrls | Json | `string[]` |
| hashtags | String? | |
| scheduledTime | DateTime? | bắt buộc nếu status scheduled |
| publishedTime | DateTime? | Phase 5 |
| status | String | `draft` \| `scheduled` \| `published` \| `failed` \| `partial` |
| createdAt | DateTime | |
| updatedAt | DateTime | |

Phase 1 chỉ cho phép tạo/sửa `draft` và `scheduled`. Không set `published` / `failed` / `partial` từ client.

### `PostLog` (tạo schema Phase 1, **không** CRUD public)

Giữ bảng để khỏi migrate lớn ở Phase 5.

| Field | Type |
|-------|------|
| id | Int PK |
| postId | Int FK |
| platform | String |
| status | String |
| errorMessage | String? |
| externalPostId | String? |
| externalUrl | String? |
| attemptedAt | DateTime |

---

## 7. API Phase 1

Base: `/api`. Header: `Authorization: Bearer <token>` (trừ login).

### Auth

| Method | Path | Body | Mô tả |
|--------|------|------|--------|
| POST | `/api/auth/login` | `{ email, password }` | Trả `{ token, user: { id, email, name } }` |
| GET | `/api/auth/me` | — | User hiện tại |

### Customers

| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/api/customers` | Danh sách |
| GET | `/api/customers/:id` | Chi tiết (không trả token fields) |
| POST | `/api/customers` | `{ name }` |
| PATCH | `/api/customers/:id` | `{ name }` |
| DELETE | `/api/customers/:id` | 409 nếu còn posts |

Không expose `facebookToken`, `ayrshareProfileKey` trong JSON response.

### Posts

| Method | Path | Query / body |
|--------|------|----------------|
| GET | `/api/posts` | `customerId`, `status`, `from`, `to` (lọc `scheduledTime`) — phục vụ calendar sau |
| GET | `/api/posts/:id` | |
| POST | `/api/posts` | xem dưới |
| PATCH | `/api/posts/:id` | không sửa bài `published` |
| DELETE | `/api/posts/:id` | chỉ `draft` / `scheduled` |

**POST body**

```json
{
  "customerId": 1,
  "title": "optional",
  "content": "bắt buộc",
  "platforms": ["facebook", "tiktok"],
  "mediaUrls": ["https://..."],
  "hashtags": "#a #b",
  "scheduledTime": "2026-09-10T10:00:00.000Z",
  "status": "draft"
}
```

**Validate**

- `platforms`: subset của `facebook`, `tiktok`; không rỗng.
- `status` ∈ `draft` | `scheduled`.
- `draft` ⇒ `scheduledTime` được phép `null`.
- `scheduled` ⇒ `scheduledTime` bắt buộc, ISO-8601 UTC, không ở quá khứ quá 1 phút.
- Mọi DateTime lưu UTC; calendar frontend tự convert timezone hiển thị.
- `customerId` phải tồn tại.

---

## 8. Auth & bảo mật Phase 1

- Seed: `ADMIN_EMAIL` / `ADMIN_PASSWORD` trong `.env` (không commit mật khẩu thật).
- JWT secret bắt buộc qua env; app refuse start nếu thiếu.
- CORS: origin từ `FRONTEND_ORIGIN` (default localhost Vite).
- Rate limit login (ví dụ 20 req/15 phút / IP) — nhẹ, tránh brute force.
- Prisma không log token customer (chưa có trên API).

---

## 9. Tech stack & chi phí (toàn dự án)

| Thành phần | Lựa chọn | Ghi chú |
|------------|----------|---------|
| Phase 1 runtime | Express + TS + Prisma + SQLite | $0 |
| Frontend (sau) | React + Vite + Tailwind + FullCalendar | $0 Vercel |
| Media (sau) | Cloudinary free tier | 5GB |
| Facebook | Graph API | $0 + App Review |
| TikTok | Ayrshare ~$25–50 hoặc Buffer ~$15–20 | bắt buộc nếu đăng TikTok |
| Scheduler (sau) | node-schedule → BullMQ+Redis khi nhiều job trùng giờ | |

---

## 10. Timeline (ước lượng, không gồm chờ Meta)

| Phase | Nội dung | Thời gian |
|-------|----------|-----------|
| **1** | Auth, Prisma, CRUD customers/posts | 3–5 ngày |
| 2 | Facebook OAuth + publish | 2–3 ngày (+ chờ review) |
| 3 | Ayrshare TikTok | 1–2 ngày |
| 4 | Calendar UI + preview + upload | 3–4 ngày |
| 5 | Scheduler, post_logs, thông báo dashboard | 2 ngày |
| 6 | Test + deploy | 2–3 ngày |

---

## 11. Rủi ro

| Rủi ro | Giảm thiểu |
|--------|------------|
| App Review chậm | Nộp quyền sớm, song song Phase 1–4 |
| Page token hết hạn | Long-lived + refresh job; flag reconnect |
| TikTok không API SME | Ayrshare/Buffer, không bot |
| TikTok cần video | Validate Phase 4 (MIME/extension); Phase 1 chỉ nhắc trong spec |
| Job trùng giờ | Phase 5 dùng queue, không `node-schedule` khi > vài khách |
| SQLite lock | Một process backend; Postgres khi nhiều instance |

---

## 12. Việc không làm trong Phase 1 (checklist)

- [ ] Graph API / Facebook Login
- [ ] Ayrshare
- [ ] Upload file
- [ ] Worker đăng bài
- [ ] Email
- [ ] Frontend
- [ ] Trả secret customer ra API

---

## 13. Bước tiếp theo

Sau khi duyệt spec này:

1. Viết implementation plan chi tiết (`docs/superpowers/plans/`).
2. Scaffold backend Phase 1 theo plan.

Nếu cần sửa: token trên PATCH customer, cho phép register, hoặc Postgres ngay — ghi rõ trước khi plan.
