# Workflow frontend — lich dang bai (nhan vien agency)

**Ngay:** 2026-09-01  
**Doi chieu:** `workflow/facebook-tiktok-posting-workflow.md` + API Phase 1 da co

---

## 1. Review (ban spec goc vs API that)

| Y tuong goc | Ket luan |
|-------------|----------|
| React + Vite + Tailwind + FullCalendar | **Giu.** Dung cho nhan vien noi bo. |
| Upload Cloudinary trong modal tao bai | **Chua lam.** API chua co `/api/media`. Form nhap URL (mot URL/dong). Upload de Phase 4+. |
| Preview FB / TikTok | **Lam.** Chi preview layout + gioi han chu; khong goi Graph/Ayrshare. |
| Click ngay tren calendar mo modal | **Lam.** Pre-fill `scheduledTime` UTC tu slot. |
| Token Facebook tren UI | **Khong.** API khong tra secret; customer chi sua `name`. |
| Dang that / webhook | **Khong.** Status chi `draft` / `scheduled`. Badge `published`/`failed`/`partial` chi hien neu API tra ve. |

**Thieu so voi file workflow backend:** khong co file frontend rieng truoc do — spec goc de Phase 4. File nay chot UI Phase 1-gan-API.

---

## 2. Man hinh

1. **Login** — `POST /api/auth/login` → luu JWT `localStorage` → `GET /api/auth/me` khi vao app.
2. **Lich** — `GET /api/posts?from=&to=` (ISO offset). Event theo `scheduledTime`; draft khong gio hien o cot "Nhap".
3. **Modal bai** — tao `POST /api/posts`, sua `PATCH`, xoa `DELETE` (chi draft/scheduled).
4. **Khach hang** — CRUD name; xoa 409 neu con post → toast loi API.

---

## 3. Map form → API

- `platforms`: checkbox `facebook` | `tiktok` (min 1).
- `mediaUrls`: tach dong, `trim`, bo rong; TikTok bat buoc >= 1 URL hop le.
- `scheduledTime`: `datetime-local` (gio may user) → `toISOString()` (UTC, co `Z` — dung Zod backend).
- `status`: `scheduled` neu user chon len lich; khong thi `draft` (co the co hoac khong `scheduledTime`).
- Khong gui `published` / `failed` / `partial`.

---

## 4. UX bat buoc

- Label that, loi ngay field (khong chi toast).
- Nut >= 44px, `cursor-pointer`, focus ring.
- Khong dung emoji lam icon.
- Empty state lich + danh sach khach.
- Responsive: lich day du desktop; mobile: list + loc ngay.

---

## 5. Khong lam o ban nay

- OAuth Facebook, Ayrshare UI, upload file, job scheduler, email.
