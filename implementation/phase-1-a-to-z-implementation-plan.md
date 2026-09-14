# Implementation plan Phase 1 - He thong quan ly lich dang bai

**Ngay:** 2026-09-01  
**Muc tieu:** Scaffold backend noi bo bang Node.js, Express, TypeScript, Prisma, SQLite va JWT.  
**Ket qua can co:** Login duoc, quan ly customers, quan ly posts, validate du lieu, co README va test/curl de nghiem thu.

---

## 1. Pham vi Phase 1

### In scope

- Khoi tao project backend Express + TypeScript.
- Prisma + SQLite.
- Bang `users`, `customers`, `posts`, `post_logs`.
- Seed mot admin tu `.env`.
- Auth login bang bcrypt + JWT.
- Route `GET /api/auth/me`.
- CRUD customers.
- CRUD posts.
- Filter posts theo `customerId`, `status`, `from`, `to`.
- Middleware auth Bearer token.
- Middleware error response thong nhat.
- README huong dan env, migrate, seed, run, curl.

### Out of scope

- Facebook OAuth.
- Facebook Graph publish.
- Ayrshare/Buffer publish.
- Upload file.
- Scheduler/worker.
- Email.
- Frontend calendar.
- Register public.
- Refresh token rotation.
- Role/permission phuc tap.

---

## 2. Cau truc folder can tao

```text
toolnew/
  prisma/
    schema.prisma
    seed.ts
  src/
    index.ts
    app.ts
    config.ts
    lib/
      prisma.ts
    middleware/
      auth.ts
      error.ts
    modules/
      auth/
        auth.routes.ts
        auth.service.ts
      customers/
        customers.routes.ts
        customers.service.ts
      posts/
        posts.routes.ts
        posts.service.ts
  .env.example
  package.json
  tsconfig.json
  README.md
```

---

## 3. Packages can cai

Runtime:

```bash
npm install express @prisma/client bcrypt jsonwebtoken cors helmet express-rate-limit dotenv zod
```

Dev:

```bash
npm install -D typescript tsx prisma @types/node @types/express @types/bcrypt @types/jsonwebtoken @types/cors
```

Script trong `package.json`:

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "prisma:migrate": "prisma migrate dev",
    "prisma:generate": "prisma generate",
    "prisma:seed": "prisma db seed"
  }
}
```

---

## 4. Env

Tao `.env.example`:

```env
DATABASE_URL="file:./dev.db"
PORT=3000
JWT_SECRET="change-me"
JWT_EXPIRES_IN="7d"
FRONTEND_ORIGIN="http://localhost:5173"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="change-this-password"
ADMIN_NAME="Admin"
```

Quy tac:

- App refuse start neu thieu `JWT_SECRET`.
- Seed refuse run neu thieu `ADMIN_EMAIL` hoac `ADMIN_PASSWORD`.
- Email normalize lowercase.
- Khong commit `.env`.

---

## 5. Prisma schema

### Enum nen dung

```prisma
enum PostStatus {
  draft
  scheduled
  published
  failed
  partial
}

enum Platform {
  facebook
  tiktok
}

enum PostLogStatus {
  success
  failed
}
```

Co the dung String cho `platform` trong `PostLog` de sau nay them platform khong migrate enum nhieu. Rieng `Post.status` nen dung enum de tranh du lieu sai.

### Model User

```prisma
model User {
  id           Int      @id @default(autoincrement())
  email        String   @unique
  passwordHash String
  name         String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

### Model Customer

```prisma
model Customer {
  id                        Int      @id @default(autoincrement())
  name                      String
  facebookPageId            String?
  facebookToken             String?
  ayrshareProfileKey        String?
  facebookReconnectRequired Boolean  @default(false)
  createdAt                 DateTime @default(now())
  updatedAt                 DateTime @updatedAt
  posts                     Post[]
}
```

### Model Post

```prisma
model Post {
  id            Int        @id @default(autoincrement())
  customerId    Int
  customer      Customer   @relation(fields: [customerId], references: [id], onDelete: Restrict)
  title         String?
  content       String
  platforms     String
  mediaUrls     String
  hashtags      String?
  scheduledTime DateTime?
  publishedTime DateTime?
  status        String     @default("draft")
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
  logs          PostLog[]

  @@index([customerId])
  @@index([status])
  @@index([scheduledTime])
}
```

### Model PostLog

```prisma
model PostLog {
  id             Int      @id @default(autoincrement())
  postId         Int
  post           Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  platform       String
  status         String
  errorMessage   String?
  externalPostId String?
  externalUrl    String?
  attemptedAt    DateTime @default(now())

  @@index([postId])
  @@index([platform])
  @@index([status])
}
```

---

## 6. API contract

Base URL: `/api`

Tat ca route can header sau, tru login:

```http
Authorization: Bearer <token>
```

### Auth

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/auth/login` | `{ "email": "...", "password": "..." }` | `{ "token": "...", "user": { "id": 1, "email": "...", "name": "..." } }` |
| GET | `/api/auth/me` | none | `{ "user": { "id": 1, "email": "...", "name": "..." } }` |

Login sai tra `401`.

### Customers

| Method | Path | Body/Query |
|--------|------|------------|
| GET | `/api/customers` | none |
| GET | `/api/customers/:id` | none |
| POST | `/api/customers` | `{ "name": "Tên khách hàng thật" }` |
| PATCH | `/api/customers/:id` | `{ "name": "Tên khách hàng cập nhật" }` |
| DELETE | `/api/customers/:id` | none |

Rules:

- Response khong tra `facebookToken`.
- Response khong tra `ayrshareProfileKey`.
- DELETE neu customer con posts thi tra `409 Conflict`.
- Khong cho PATCH token fields trong Phase 1.

### Posts

| Method | Path | Body/Query |
|--------|------|------------|
| GET | `/api/posts` | `customerId`, `status`, `from`, `to` |
| GET | `/api/posts/:id` | none |
| POST | `/api/posts` | post body |
| PATCH | `/api/posts/:id` | partial post body |
| DELETE | `/api/posts/:id` | none |

POST body:

```json
{
  "customerId": 1,
  "title": "Khuyen mai thang 9",
  "content": "Noi dung bai viet",
  "platforms": ["facebook", "tiktok"],
  "mediaUrls": ["https://example.com/video.mp4"],
  "hashtags": "#sale #thang9",
  "scheduledTime": "2026-09-10T10:00:00.000Z",
  "status": "scheduled"
}
```

Rules:

- `platforms` va `mediaUrls` luu DB dang JSON string khi dung SQLite Phase 1; API van nhan/tra array. Khi migrate Postgres co the doi ve Prisma `Json`.
- `status` Phase 1 chi nhan `draft` hoac `scheduled`.
- `scheduled` bat buoc co `scheduledTime`.
- `scheduledTime` khong duoc o qua khu.
- `platforms` chi nhan `facebook`, `tiktok`.
- Neu platforms co `tiktok`, `mediaUrls` khong duoc rong.
- DELETE chi cho post `draft` hoac `scheduled`.
- PATCH khong cho sua post da `published`.

---

## 7. Validation bang Zod

Nen tao schema rieng cho:

- `loginSchema`
- `createCustomerSchema`
- `updateCustomerSchema`
- `createPostSchema`
- `updatePostSchema`
- `listPostsQuerySchema`

Validation detail:

- String input can `trim`.
- Empty string tra `400`.
- Date parse bang `new Date(value)`, check `Number.isNaN(date.getTime())`.
- Cho phep lech qua khu toi da 1 phut neu can tranh clock skew.
- Query `from` va `to` filter theo `scheduledTime`.

---

## 8. Error response format

Dung mot format thong nhat:

```json
{
  "error": {
    "message": "Customer not found",
    "code": "NOT_FOUND"
  }
}
```

HTTP status goi y:

| Status | Khi nao |
|--------|---------|
| 400 | Body/query sai validate |
| 401 | Thieu token, token sai, login sai |
| 404 | Khong tim thay resource |
| 409 | Xung dot nghiep vu, vi du xoa customer con posts |
| 500 | Loi server khong mong doi |

---

## 9. Thu tu implement tu A den Z

1. Khoi tao `package.json`, `tsconfig.json`.
2. Cai packages runtime/dev.
3. Tao `.env.example`, `.gitignore`.
4. Tao Prisma schema.
5. Chay `npx prisma migrate dev --name init`.
6. Tao `prisma/seed.ts` seed admin.
7. Cau hinh Prisma seed trong `package.json`.
8. Tao `src/config.ts` doc env va validate env.
9. Tao `src/lib/prisma.ts` dung chung Prisma Client.
10. Tao middleware `error.ts`.
11. Tao middleware `auth.ts`.
12. Tao auth service login/me.
13. Tao auth routes.
14. Tao customers service/routes.
15. Tao posts service/routes.
16. Tao `src/app.ts` mount route va middleware.
17. Tao `src/index.ts` listen port.
18. Viet README.
19. Chay build TypeScript.
20. Chay migrate + seed.
21. Test bang curl/Postman.
22. Sua loi validate/response neu co.
23. Commit Phase 1 neu can.

---

## 10. Curl nghiem thu

### Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"change-this-password"}'
```

### Me

```bash
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer TOKEN"
```

### Tao customer

```bash
curl -X POST http://localhost:3000/api/customers \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Tên khách hàng thật"}'
```

### Tao post scheduled

```bash
curl -X POST http://localhost:3000/api/posts \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": 1,
    "title": "Bài đăng tháng 9",
    "content": "Nội dung bài viết",
    "platforms": ["facebook", "tiktok"],
    "mediaUrls": ["https://example.com/video.mp4"],
    "hashtags": "#thang9",
    "scheduledTime": "2026-09-10T10:00:00.000Z",
    "status": "scheduled"
  }'
```

### List posts cho calendar

```bash
curl "http://localhost:3000/api/posts?customerId=1&status=scheduled&from=2026-09-01T00:00:00.000Z&to=2026-09-30T23:59:59.999Z" \
  -H "Authorization: Bearer TOKEN"
```

---

## 11. Definition of done

- `npm run build` pass.
- Prisma migrate tao DB thanh cong.
- Seed admin thanh cong.
- Login tra JWT.
- Route protected khong co token tra `401`.
- CRUD customer chay duoc.
- DELETE customer con posts tra `409`.
- CRUD posts chay duoc.
- Tao `scheduled` khong co `scheduledTime` tra `400`.
- Tao TikTok post khong co `mediaUrls` tra `400`.
- Response customer khong lo `facebookToken` va `ayrshareProfileKey`.
- README co day du lenh chay va curl co ban.

---

## 12. Ghi chu cho Phase 2+

- Khi implement Facebook OAuth, can kiem tra lai ten permission theo docs Meta moi nhat.
- Khi implement TikTok, chot Ayrshare hay Buffer truoc khi code.
- Truoc khi bat scheduler, can thiet ke job id de update/cancel job theo post id.
- Truoc khi upload, can chot Cloudinary/S3 va validate MIME/size/duration.
- Truoc khi deploy production, migrate sang Postgres neu chay nhieu instance backend.
