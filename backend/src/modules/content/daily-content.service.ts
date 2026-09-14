import crypto from "node:crypto";
import { z } from "zod";
import { config } from "../../config.js";
import { AppError } from "../../middleware/error.js";
import { contentSheetColumns } from "./content.service.js";

const sheetRowSchema = z.object({
  thoi_gian: z.string().min(1),
  tu_khoa_chinh: z.string().min(1),
  tu_khoa_phu: z.string().min(1),
  y_dinh_tim_kiem: z.enum(["tìm hiểu vấn đề", "so sánh giá", "tìm thợ sửa gấp"]),
  title_seo: z.string().min(1).max(80),
  meta_description: z.string().min(80).max(190),
  h1: z.string().min(1).max(120),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  dan_y: z.string().min(1),
  noi_dung_seo: z.string().min(100),
  caption_tiktok: z.string().min(1),
  caption_facebook: z.string().min(1),
  kich_ban_video: z.string().min(1),
  hashtag: z.string().min(1),
  link_nguon: z.string().url(),
  image: z.string().min(1),
  noi_dau_khach: z.string().min(1)
}).strict();

const aiRowsSchema = z.object({
  rows: z.array(sheetRowSchema).min(1).max(20)
});

type SheetRow = z.infer<typeof sheetRowSchema>;

type SourceSeed = {
  platform: "facebook" | "tiktok" | "website" | "other";
  sourceUrl: string;
  sourceTitle: string;
  imageUrl: string;
  notes: string;
};

const defaultSourceSeeds: SourceSeed[] = [
  {
    platform: "tiktok",
    sourceUrl: "https://shop-vn.tiktok.com/pdp/1731153660296399196",
    sourceTitle: "Cửa nhôm kính thực tế - góc đo khe, chống dột",
    imageUrl: "https://kinhcuongluctphcm.com.vn/upload/elfinder/lam-cua-nhom-kinh.jpg",
    notes: "Hook về đo lỗ tường, khe cánh, lỗi dột sau khi lắp."
  },
  {
    platform: "tiktok",
    sourceUrl: "https://shop-vn.tiktok.com/pdp/1729941928657651998",
    sourceTitle: "Cửa nhôm Xingfa nhiều cánh - so giá theo cấu tạo",
    imageUrl: "https://cuaxepnhuagiare.com/wp-content/uploads/2020/04/C%E1%BB%ADa-nh%C3%B4m-Xingfa-4-c%C3%A1nh-cho-c%E1%BB%ADa-ch%C3%ADnh.jpg",
    notes: "So sánh giá phải tách nhôm, kính, phụ kiện, nhân công."
  },
  {
    platform: "website",
    sourceUrl: "https://nhomkinhquoctuanlongan.com/cua-nhom-xingfa-6",
    sourceTitle: "Mẫu cửa nhôm Xingfa - kiểm tra độ dày và phụ kiện",
    imageUrl: "https://nhomkinhquoctuanlongan.com/upload/product/mau-cua-nhom-xingfa-nhap-khau-dep-13-7327.jpg",
    notes: "Không chốt chỉ vì tem; kiểm tra hệ nhôm, kính, phụ kiện."
  },
  {
    platform: "tiktok",
    sourceUrl: "https://shop-vn.tiktok.com/pdp/1731761079707207986",
    sourceTitle: "Phụ kiện cửa lùa - ray, bánh xe, kẹt cửa",
    imageUrl: "https://static.alumil.com/userfiles/images/default-source/homeowners/plan-your-project/other-hardware.jpg?sfvrsn=9cf110c6_2",
    notes: "Cửa lùa kéo nặng, ray đọng nước, bánh xe yếu."
  },
  {
    platform: "website",
    sourceUrl: "https://masterprod.ro/en/pereti-cortina/",
    sourceTitle: "Vách kính mặt tiền - khung nhôm và chống rung",
    imageUrl: "https://masterprod.ro/wp-content/uploads/2023/01/pereti-cortina-profile-aluminiu.webp",
    notes: "Vách kính cần tách giá khung, kính, phụ kiện, gia công."
  },
  {
    platform: "website",
    sourceUrl: "https://www.amjwindows.com/AMJ-150T-Thermally-Broken-Lift-and-Sliding-Door-p.html",
    sourceTitle: "Cửa trượt cách âm - khe hở và gioăng kín",
    imageUrl: "https://www.amjwindows.com/Uploads/image/20240830/20240830122220_89126.jpg",
    notes: "Cách âm không chỉ do kính dày; khe cánh và gioăng rất quan trọng."
  },
  {
    platform: "website",
    sourceUrl: "https://mokkdoor.en.made-in-china.com/product/KTGrWiSDXdkY/China-Aluminum-Bathroom-Door-for-Houses-Toilet-Door-Interior-Waterproof-Single-Door-Leaf-Latest-Design-by-China-Supplier.html",
    sourceTitle: "Cửa nhà vệ sinh chống ẩm",
    imageUrl: "https://image.made-in-china.com/2f0j00iDLCcwvqfabo/Aluminum-Bathroom-Door-for-Houses-Toilet-Door-Interior-Waterproof-Single-Door-Leaf-Latest-Design-by-China-Supplier.webp",
    notes: "Chống ẩm, khe chân, silicone, bản lề trong môi trường ẩm."
  },
  {
    platform: "website",
    sourceUrl: "https://oneplusaluminum.en.made-in-china.com/product/vnhYTFXcACVp/China-Commercial-Apartment-Modern-French-Luxury-Large-Glass-Aluminium-Frame-Residential-Office-Casement-Metal-Door.html",
    sourceTitle: "Cửa kính khung nhôm - chọn kính cường lực theo ô cửa",
    imageUrl: "https://image.made-in-china.com/365f3j00fSwcFYygSzoJ/Commercial-Apartment-Modern-French-Luxury-Large-Glass-Aluminium-Frame-Residential-Office-Casement-Metal-Door.webp",
    notes: "Chọn kính theo kích thước ô, vị trí va chạm, khung đỡ."
  },
  {
    platform: "website",
    sourceUrl: "https://www.villapoint.pl/jak-wyregulowac-drzwi-balkonowe/",
    sourceTitle: "Chỉnh cửa bị xệ, cạ nền",
    imageUrl: "https://www.villapoint.pl/wp-content/uploads/2025/04/Regulacja-drzwi-balkonowych-w-nowoczesnym-mieszkaniu.jpg",
    notes: "Cửa xệ/dột cần kiểm tra bản lề, khung, silicone, khe cánh."
  },
  {
    platform: "tiktok",
    sourceUrl: "https://shop-vn.tiktok.com/pdp/1730888065541901158",
    sourceTitle: "Khóa và phụ kiện cửa nhôm",
    imageUrl: "https://image.made-in-china.com/365f3j00jYMkisbZyAog/Herrajes-modernos-de-aluminio-de-alta-calidad-para-puertas-y-ventanas-silenciosos-y-anti-ruido.webp",
    notes: "Phụ kiện rẻ làm cửa nhanh xệ, khóa lỏng, ray kẹt."
  }
];

function base64url(value: Buffer | string) {
  return Buffer.from(value).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function formatVietnamDateTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

function imageFormula(value: string) {
  if (/^=IMAGE\(/i.test(value.trim())) {
    return value.trim();
  }
  const escapedUrl = value.trim().replace(/"/g, "%22");
  return `=IMAGE("${escapedUrl}";4;120;160)`;
}

function loadSourceSeeds() {
  if (!config.dailyContent.sourceSeedsJson) {
    return defaultSourceSeeds;
  }

  try {
    const parsed = z.array(z.object({
      platform: z.enum(["facebook", "tiktok", "website", "other"]),
      sourceUrl: z.string().url(),
      sourceTitle: z.string().min(3),
      imageUrl: z.string().url(),
      notes: z.string().min(1)
    })).parse(JSON.parse(config.dailyContent.sourceSeedsJson));
    return parsed;
  } catch {
    throw new AppError(500, "DAILY_SOURCE_SEEDS_INVALID", "DAILY_CONTENT_SOURCE_SEEDS_JSON không đúng JSON/schema.");
  }
}

function dailyPrompt(today: string, sourceSeeds: SourceSeed[]) {
  return `You are a Vietnamese local SEO and short-form social strategist for aluminum-glass construction services in Southern Vietnam.
Create ${config.dailyContent.rowCount} fresh Google Sheet rows for today. Use the same 17-column format only.

Business context:
${config.dailyContent.businessContext}

Today: ${today}
Audience: buyers in Southern Vietnam and Mekong Delta.
Goal: daily fresh content inspired by viral-like hooks: leaking doors, sagging doors, noisy street, stuck sliding tracks, vague quotes, weak hinges/locks, bathroom humidity, storefront glass vibration.

Source seeds:
${JSON.stringify(sourceSeeds)}

Return JSON only with this shape:
{"rows":[{${contentSheetColumns.map((field) => `"${field}":"..."`).join(",")}}]}

Strict rules:
- Return exactly ${config.dailyContent.rowCount} rows.
- Each row must contain exactly these fields: ${contentSheetColumns.join(", ")}.
- thoi_gian: use "${today}".
- y_dinh_tim_kiem: exactly one of "tìm hiểu vấn đề", "so sánh giá", "tìm thợ sửa gấp".
- title_seo under 65 Vietnamese characters.
- meta_description should be 140-170 Vietnamese characters.
- slug lowercase ASCII with hyphens.
- dan_y has 3-5 short numbered lines.
- noi_dung_seo has practical technical cause/explanation, 220-420 Vietnamese words.
- caption_tiktok and caption_facebook must not be identical.
- kich_ban_video must include Hook 0-3s, Problem 3-10s, Solution 10-20s, CTA.
- hashtag has 3-6 hashtags, rotate locality/problem; do not repeat the same hashtag set.
- link_nguon must be one specific URL from source seeds.
- image must be the matching stable imageUrl from the same seed, not a CDN Facebook/TikTok temp URL.
- noi_dau_khach must be a specific observable pain point; no generic broad complaints.
- Do not invent exact prices, warranties, customer names, completed project claims, certifications, or guaranteed timelines.
- Write naturally for miền Nam/miền Tây, but do not caricature dialect.`;
}

async function callAi(prompt: string) {
  if (!config.openai.apiKey) {
    throw new AppError(503, "AI_NOT_CONFIGURED", "Thiếu AI_API_KEY/NVIDIA_API_KEY trong biến môi trường.");
  }

  const apiBaseUrl = config.openai.baseUrl.replace(/\/+$/, "");
  const body = {
    model: config.openai.model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    top_p: 0.9,
    max_tokens: 12000,
    response_format: { type: "json_object" }
  };

  let response = await fetch(`${apiBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openai.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok && response.status === 400) {
    const { response_format: _responseFormat, ...fallbackBody } = body;
    response = await fetch(`${apiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openai.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(fallbackBody)
    });
  }

  const result = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
  const outputText = result.choices?.[0]?.message?.content;
  if (!response.ok || !outputText) {
    throw new AppError(502, "AI_GENERATION_FAILED", result.error?.message || "AI did not return content.");
  }
  return outputText;
}

function parseAiRows(outputText: string) {
  const jsonMatch = outputText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new AppError(502, "AI_RESPONSE_INVALID", "AI không trả về JSON.");
  }

  const parsed = aiRowsSchema.parse(JSON.parse(jsonMatch[0]));
  return parsed.rows.map((row) => ({
    ...row,
    image: imageFormula(row.image)
  }));
}

async function getGoogleAccessToken() {
  const { serviceAccountEmail, privateKey } = config.googleSheets;
  if (!serviceAccountEmail || !privateKey) {
    throw new AppError(503, "GOOGLE_SHEETS_NOT_CONFIGURED", "Thiếu GOOGLE_SERVICE_ACCOUNT_EMAIL hoặc GOOGLE_PRIVATE_KEY.");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: serviceAccountEmail,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  };
  const unsignedJwt = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsignedJwt);
  signer.end();
  const signature = signer.sign(privateKey);
  const assertion = `${unsignedJwt}.${base64url(signature)}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  const result = (await response.json()) as { access_token?: string; error_description?: string; error?: string };
  if (!response.ok || !result.access_token) {
    throw new AppError(502, "GOOGLE_AUTH_FAILED", result.error_description || result.error || "Không lấy được Google access token.");
  }
  return result.access_token;
}

function sheetValues(rows: SheetRow[]) {
  return rows.map((row) => contentSheetColumns.map((field) => row[field]));
}

async function sheetsRequest(path: string, token: string, init: RequestInit) {
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${config.googleSheets.spreadsheetId}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof result === "object" && result && "error" in result
      ? JSON.stringify(result.error)
      : `Google Sheets request failed with ${response.status}`;
    throw new AppError(502, "GOOGLE_SHEETS_WRITE_FAILED", message);
  }
  return result;
}

async function writeRows(rows: SheetRow[]) {
  const token = await getGoogleAccessToken();
  const sheetName = encodeURIComponent(config.googleSheets.sheetName);
  const headerRange = `/${encodeURIComponent("values")}/${sheetName}!A1:Q1?valueInputOption=USER_ENTERED`;
  await sheetsRequest(headerRange, token, {
    method: "PUT",
    body: JSON.stringify({ values: [contentSheetColumns] })
  });

  if (config.dailyContent.writeMode === "replace") {
    const clearRange = `/${encodeURIComponent("values")}/${sheetName}!A2:Q1000:clear`;
    await sheetsRequest(clearRange, token, { method: "POST", body: JSON.stringify({}) });
    const updateRange = `/${encodeURIComponent("values")}/${sheetName}!A2:Q${rows.length + 1}?valueInputOption=USER_ENTERED`;
    return sheetsRequest(updateRange, token, {
      method: "PUT",
      body: JSON.stringify({ values: sheetValues(rows) })
    });
  }

  const appendRange = `/${encodeURIComponent("values")}/${sheetName}!A:Q:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  return sheetsRequest(appendRange, token, {
    method: "POST",
    body: JSON.stringify({ values: sheetValues(rows) })
  });
}

export async function runDailyContentJob() {
  const sourceSeeds = loadSourceSeeds();
  const today = formatVietnamDateTime();
  const outputText = await callAi(dailyPrompt(today, sourceSeeds));
  const rows = parseAiRows(outputText);
  if (rows.length !== config.dailyContent.rowCount) {
    throw new AppError(502, "AI_RESPONSE_INVALID", `AI trả ${rows.length} dòng, cần ${config.dailyContent.rowCount} dòng.`);
  }
  await writeRows(rows);

  return {
    spreadsheetId: config.googleSheets.spreadsheetId,
    sheetName: config.googleSheets.sheetName,
    rowCount: rows.length,
    mode: config.dailyContent.writeMode,
    generatedAt: today
  };
}

export function assertCronSecret(input: string | undefined) {
  if (!config.dailyContent.cronSecret) {
    throw new AppError(503, "CRON_SECRET_NOT_CONFIGURED", "Thiếu CRON_SECRET để bảo vệ endpoint cron.");
  }
  if (input !== config.dailyContent.cronSecret) {
    throw new AppError(401, "UNAUTHORIZED", "Cron secret không đúng.");
  }
}
