# Backend — Post scheduler API

Express + TypeScript + Prisma + SQLite + JWT.

Backend quản lý theo khách hàng và cấu hình kênh riêng cho từng khách:

- Facebook: `facebookConnected`, `facebookPageId`, `facebookPageName`
- TikTok: `tiktokConnected`, `tiktokProfileName`
- Facebook/TikTok token được lưu từ OAuth callback, không nhập thủ công trên UI.

```bash
cp .env.example .env
npm install
npm run db:setup
npm run prisma:seed
npm run dev
```

http://localhost:3000

`prisma migrate dev` can be used where Prisma's schema engine runs normally. In this workspace, `npm run db:setup` is the reliable SQLite setup path and applies the checked-in migration SQL.

## Env

```env
DATABASE_URL="file:./dev.db"
HOST="127.0.0.1"
PORT=3000
JWT_SECRET="change-me"
JWT_EXPIRES_IN="7d"
FRONTEND_ORIGIN="http://localhost:5173"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="change-this-password"
ADMIN_NAME="Admin"
FACEBOOK_APP_ID=""
FACEBOOK_APP_SECRET=""
FACEBOOK_REDIRECT_URI="http://127.0.0.1:3000/api/integrations/facebook/callback"
FACEBOOK_GRAPH_VERSION="v20.0"
FACEBOOK_SCOPES="pages_show_list,pages_manage_posts,pages_read_engagement"
TIKTOK_CLIENT_KEY=""
TIKTOK_CLIENT_SECRET=""
TIKTOK_REDIRECT_URI="https://your-domain.example/api/integrations/tiktok/callback"
TIKTOK_SCOPES="user.info.basic,video.publish"
TIKTOK_DEFAULT_PRIVACY_LEVEL="SELF_ONLY"
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-4.1-mini"
AI_API_KEY=""
AI_BASE_URL="https://api.openai.com/v1"
AI_MODEL="gpt-4.1-mini"
```

## Content Lab

`/content-lab` lưu bài tham khảo theo từng hồ sơ: link nguồn, chỉ số quan sát và ảnh gốc/công trình. Khi có `AI_API_KEY` hoặc `OPENAI_API_KEY`, Content Lab tạo một nháp mới theo các cột Google Sheet hiện có, đồng thời bổ sung `noi_dau_khach` để nội dung bám đúng vấn đề người mua.

Backend gọi AI qua endpoint OpenAI-compatible `/chat/completions`. OpenAI dùng mặc định `AI_BASE_URL="https://api.openai.com/v1"`. Nếu dùng NVIDIA/NIM, tạo key mới rồi đặt trong `.env`, ví dụ `AI_BASE_URL="https://integrate.api.nvidia.com/v1"` và `AI_MODEL` theo model NVIDIA bạn chọn. Không commit hoặc dán public API key.

AI chỉ nhận bài nguồn mà người dùng đã chọn trong Content Lab. Prompt yêu cầu học hook/cấu trúc, không sao chép caption, không bịa giá, công trình, chứng nhận hay kết quả. Nội dung mới dùng giọng miền Nam/miền Tây mạch lạc, không bắt chước phương ngữ. Cột `image` chỉ dùng URL ảnh ổn định, không dùng URL CDN tạm của Facebook.

## Daily NVIDIA -> Google Sheet

Endpoint cron:

```bash
GET /api/cron/daily-content
POST /api/cron/daily-content
```

Gọi endpoint bằng bearer secret:

```bash
curl https://your-domain.example/api/cron/daily-content \
  -H "Authorization: Bearer $CRON_SECRET"
```

Biến môi trường cần có khi deploy:

```env
NVIDIA_API_KEY=""
NVIDIA_MODEL="openai/gpt-oss-20b"
CRON_SECRET="generate-a-long-random-secret"
GOOGLE_SHEET_ID="19nSL3_mrZ9XmaIVabHCXBpd75DgmaYW2n6BpADWXGcw"
GOOGLE_SHEET_NAME="SEO_nhomkinh"
GOOGLE_SERVICE_ACCOUNT_EMAIL=""
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
DAILY_CONTENT_ROW_COUNT=10
DAILY_CONTENT_WRITE_MODE="append"
```

Share Google Sheet cho `GOOGLE_SERVICE_ACCOUNT_EMAIL` quyền Editor. Job sẽ tạo đúng 17 cột cũ, sinh nội dung bằng NVIDIA OpenAI-compatible API, rồi ghi thêm dòng vào tab `SEO_nhomkinh`.

Vercel: deploy thư mục `backend` làm project root. `vercel.json` đã đặt cron chạy `/api/cron/daily-content` mỗi ngày. Vercel Hobby hỗ trợ cron hằng ngày nhưng thời điểm chạy có thể lệch trong khung giờ.

Render: `render.yaml` deploy backend web service free. Render cron job riêng hiện có phí tối thiểu, nên nếu dùng Render free thì dùng cron ngoài gọi endpoint bằng `CRON_SECRET`.

## Auth

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"change-this-password"}'

curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer TOKEN"
```

Customers và posts: `Authorization: Bearer TOKEN`. Xem `implementation/phase-1-a-to-z-implementation-plan.md`.

## Customer channel config

Tạo customer trước:

```bash
curl -X POST http://localhost:3000/api/customers \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Công ty ABC",
    "contactName": "Anh Minh",
    "contactName": "Anh Minh"
  }'
```

Kết nối Facebook cho customer bằng OAuth:

```bash
curl http://localhost:3000/api/integrations/customers/1/facebook/start \
  -H "Authorization: Bearer TOKEN"
```

Response trả `authUrl`. Mở URL đó để login Facebook và cấp quyền Page. Callback backend sẽ lưu Page ID, Page name và Page access token vào customer.

Trong Meta App Dashboard, `FACEBOOK_REDIRECT_URI` phải được thêm vào Valid OAuth Redirect URIs.

Nếu Facebook account có nhiều Fanpage, backend lưu từng Page vào bảng `FacebookPage`. Khi tạo post Facebook, request phải gửi Page mục tiêu:

```json
{
  "customerId": 1,
  "content": "Sale 30% hôm nay",
  "platforms": ["facebook"],
  "facebookPageIds": ["123456789"],
  "mediaUrls": [],
  "status": "scheduled",
  "scheduledTime": "2026-09-05T13:00:00.000Z"
}
```

Kết nối TikTok cho customer bằng OAuth:

```bash
curl http://localhost:3000/api/integrations/customers/1/tiktok/start \
  -H "Authorization: Bearer TOKEN"
```

Response trả `authUrl`. Mở URL đó để khách login TikTok và cấp quyền `user.info.basic,video.publish`. Callback backend sẽ lưu access token, refresh token và display name.

TikTok không login bằng mật khẩu trong app này. Với TikTok Developer App, cấu hình Login Kit redirect URI phải là HTTPS, ví dụ `https://your-domain.example/api/integrations/tiktok/callback`. Direct Post cần bật Content Posting API và app/user phải được cấp scope `video.publish`.

Khi tạo post, backend chỉ cho chọn platform đã cấu hình cho customer đó. Ví dụ customer chưa có `facebookConnected + facebookPageId` thì post Facebook trả `FACEBOOK_NOT_CONFIGURED`.
