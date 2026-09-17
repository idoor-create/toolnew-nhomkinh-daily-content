import "dotenv/config";

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function numberEnv(name: string, fallback: number): number {
  const rawValue = process.env[name]?.trim();

  if (!rawValue) {
    return fallback;
  }

  const value = Number(rawValue);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return value;
}

export const config = {
  host: process.env.HOST?.trim() || "127.0.0.1",
  port: numberEnv("PORT", 3000),
  jwtSecret: requiredEnv("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  admin: {
    email: process.env.ADMIN_EMAIL?.trim().toLowerCase() || "",
    password: process.env.ADMIN_PASSWORD || "",
    name: process.env.ADMIN_NAME?.trim() || "Admin"
  },
  frontendOrigins: (process.env.FRONTEND_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  facebook: {
    appId: process.env.FACEBOOK_APP_ID?.trim() || "",
    appSecret: process.env.FACEBOOK_APP_SECRET?.trim() || "",
    redirectUri:
      process.env.FACEBOOK_REDIRECT_URI?.trim() ||
      `http://${process.env.HOST?.trim() || "127.0.0.1"}:${numberEnv("PORT", 3000)}/api/integrations/facebook/callback`,
    graphVersion: process.env.FACEBOOK_GRAPH_VERSION?.trim() || "v20.0",
    scopes: (process.env.FACEBOOK_SCOPES || "pages_show_list,pages_manage_posts,pages_read_engagement")
      .split(",")
      .map((scope) => scope.trim())
      .filter(Boolean)
  },
  tiktok: {
    clientKey: process.env.TIKTOK_CLIENT_KEY?.trim() || "",
    clientSecret: process.env.TIKTOK_CLIENT_SECRET?.trim() || "",
    redirectUri:
      process.env.TIKTOK_REDIRECT_URI?.trim() ||
      `http://${process.env.HOST?.trim() || "127.0.0.1"}:${numberEnv("PORT", 3000)}/api/integrations/tiktok/callback`,
    scopes: (process.env.TIKTOK_SCOPES || "user.info.basic,video.publish")
      .split(",")
      .map((scope) => scope.trim())
      .filter(Boolean),
    defaultPrivacyLevel: process.env.TIKTOK_DEFAULT_PRIVACY_LEVEL?.trim() || "SELF_ONLY"
  },
  openai: {
    apiKey: process.env.AI_API_KEY?.trim() || process.env.NVIDIA_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim() || "",
    baseUrl:
      process.env.AI_BASE_URL?.trim() ||
      (process.env.NVIDIA_API_KEY?.trim() ? "https://integrate.api.nvidia.com/v1" : "https://api.openai.com/v1"),
    model:
      process.env.AI_MODEL?.trim() ||
      process.env.NVIDIA_MODEL?.trim() ||
      process.env.OPENAI_MODEL?.trim() ||
      (process.env.NVIDIA_API_KEY?.trim() ? "openai/gpt-oss-20b" : "gpt-4.1-mini")
  },
  googleSheets: {
    spreadsheetId: process.env.GOOGLE_SHEET_ID?.trim() || "19nSL3_mrZ9XmaIVabHCXBpd75DgmaYW2n6BpADWXGcw",
    sheetName: process.env.GOOGLE_SHEET_NAME?.trim() || "SEO_nhomkinh",
    serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() || "",
    privateKey: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n").trim()
  },
  dailyContent: {
    cronSecret: process.env.CRON_SECRET?.trim() || "",
    rowCount: numberEnv("DAILY_CONTENT_ROW_COUNT", 10),
    writeMode: process.env.DAILY_CONTENT_WRITE_MODE?.trim() || "append",
    businessContext:
      process.env.DAILY_CONTENT_BUSINESS_CONTEXT?.trim() ||
      "Cửa Nhôm Kính Xingfa Tiền Giang, xưởng tại Mỹ Tho. Phục vụ Mỹ Tho, Châu Thành, Cai Lậy, Gò Công và miền Tây. Tư vấn qua Zalo 089 999 2618. Không bịa giá, không bịa công trình; luôn yêu cầu khổ lỗ tường, hướng mở và ảnh/video hiện trạng.",
    sourceSeedsJson: process.env.DAILY_CONTENT_SOURCE_SEEDS_JSON?.trim() || ""
  }
};
