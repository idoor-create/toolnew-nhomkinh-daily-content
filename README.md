# Lịch đăng bài Facebook & TikTok

```text
toolnew/
  backend/      Express + Prisma + SQLite + JWT
  frontend/     React + Vite + Tailwind + FullCalendar
  workflow/     Luồng nghiệp vụ
```

## Chạy

**Terminal 1 — API**

```bash
cd backend
cp .env.example .env
npm install
npm run prisma:migrate -- --name init
npm run prisma:seed
npm run dev
```

**Terminal 2 — UI**

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Mở http://localhost:5173 — đăng nhập `admin@example.com` / mật khẩu trong `backend/.env`.

Phase 1: CRUD khách và bài (draft/scheduled). Chưa đăng Facebook/TikTok, chưa upload file.
