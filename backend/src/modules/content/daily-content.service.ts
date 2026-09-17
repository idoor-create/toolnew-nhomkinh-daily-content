import crypto from "node:crypto";
import { z } from "zod";
import { config } from "../../config.js";
import { AppError } from "../../middleware/error.js";
import { prisma } from "../../lib/prisma.js";
import { getDailySettings } from "./daily-settings.service.js";
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

function dailyPrompt(
  today: string,
  sourceSeeds: SourceSeed[],
  rowCount = config.dailyContent.rowCount,
  businessContext = config.dailyContent.businessContext,
  variationContext = ""
) {
  return `Create ${rowCount} Vietnamese SEO sheet row(s) for aluminum-glass doors/windows in Tiền Giang / miền Tây.

Business: ${businessContext}

Today thoi_gian value: "${today}"
Seed(s): ${JSON.stringify(sourceSeeds)}
Variation context: ${variationContext || "Use a fresh local customer problem and do not repeat recent angles."}

Reply with ONE JSON object only. First character must be {. No markdown. No explanation.
Shape:
{"rows":[{${contentSheetColumns.map((field) => `"${field}":"..."`).join(",")}}]}

Rules:
- Exactly ${rowCount} row(s), all fields required.
- y_dinh_tim_kiem: one of "tìm hiểu vấn đề" | "so sánh giá" | "tìm thợ sửa gấp"
- title_seo < 65 chars; meta_description 120-160 chars; slug ascii-hyphen
- noi_dung_seo 80-120 Vietnamese words; captions < 300 chars; kich_ban_video short Hook/Problem/Solution/CTA
- link_nguon + image from the seed URLs above
- Make tu_khoa_chinh, title_seo, h1, slug, noi_dau_khach, captions, and hashtag meaningfully different from recent rows.
- Each row must have a specific daily angle: location, symptom, customer situation, and CTA should not be copied from older rows.
- No invented prices, warranties, names, certifications`;
}

async function callAi(prompt: string) {
  if (!config.openai.apiKey) {
    throw new AppError(503, "AI_NOT_CONFIGURED", "Thiếu AI_API_KEY/NVIDIA_API_KEY trong biến môi trường.");
  }

  const apiBaseUrl = config.openai.baseUrl.replace(/\/+$/, "");
  const body = {
    model: config.openai.model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.6,
    top_p: 0.9,
    // gpt-oss spends many tokens on "reasoning" before final content.
    max_tokens: 4500
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const response = await fetch(`${apiBaseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.openai.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const result = (await response.json()) as {
      choices?: Array<{
        message?: { content?: string | null; reasoning?: string | null };
        text?: string;
        finish_reason?: string;
      }>;
      error?: { message?: string; code?: string };
      detail?: string;
    };

    if (!response.ok) {
      const message = result.error?.message || result.detail || `AI HTTP ${response.status} model=${config.openai.model}`;
      throw new AppError(502, "AI_GENERATION_FAILED", message);
    }

    const message = result.choices?.[0]?.message;
    const outputText =
      (typeof message?.content === "string" && message.content.trim()) ||
      (typeof message?.reasoning === "string" && message.reasoning.trim()) ||
      result.choices?.[0]?.text ||
      "";

    if (!outputText) {
      throw new AppError(
        502,
        "AI_GENERATION_FAILED",
        `AI trống (model=${config.openai.model}, finish=${result.choices?.[0]?.finish_reason || "?"}).`
      );
    }
    return outputText;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new AppError(504, "AI_TIMEOUT", "AI quá chậm (>25s). Dùng nội dung fallback để vẫn cập nhật Sheet.");
    }
    throw new AppError(502, "AI_GENERATION_FAILED", error instanceof Error ? error.message : "AI request failed.");
  } finally {
    clearTimeout(timeout);
  }
}

function extractJsonObject(text: string) {
  const start = text.indexOf('{"rows"');
  const from = start >= 0 ? start : text.indexOf("{");
  if (from < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = from; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(from, i + 1);
      }
    }
  }
  return null;
}

function parseAiRows(outputText: string) {
  const jsonText = extractJsonObject(outputText);
  if (!jsonText) {
    throw new AppError(
      502,
      "AI_RESPONSE_INVALID",
      `AI không trả về JSON. Preview: ${outputText.replace(/\s+/g, " ").slice(0, 240)}`
    );
  }

  try {
    const parsed = aiRowsSchema.parse(JSON.parse(jsonText));
    return parsed.rows.map((row) => ({
      ...row,
      image: imageFormula(row.image)
    }));
  } catch (error) {
    throw new AppError(
      502,
      "AI_RESPONSE_INVALID",
      `JSON AI không đúng schema. Preview: ${jsonText.replace(/\s+/g, " ").slice(0, 240)}`
    );
  }
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function compactText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hashToNumber(value: string) {
  return crypto.createHash("sha256").update(value).digest().readUInt32BE(0);
}

function pickRotated<T>(items: T[], index: number) {
  return items[((index % items.length) + items.length) % items.length];
}

function fallbackRow(today: string, seed: SourceSeed, rowIndex: number, businessContext: string, variationOffset = 0): SheetRow {
  const topics = [
    {
      keyword: "cửa nhôm kính bị dột nước",
      intent: "tìm thợ sửa gấp" as const,
      pain: "Mưa tạt vào khe cánh, nước len qua silicone và làm ẩm nền nhà.",
      fix: "kiểm tra khe hở, gioăng, silicone ngoài trời và độ dốc ray thoát nước"
    },
    {
      keyword: "báo giá cửa nhôm Xingfa Mỹ Tho",
      intent: "so sánh giá" as const,
      pain: "Khách nhận nhiều báo giá khác nhau nhưng không biết giá lệch do nhôm, kính hay phụ kiện.",
      fix: "tách rõ hệ nhôm, độ dày kính, phụ kiện, khối lượng thi công và vị trí lắp"
    },
    {
      keyword: "cửa lùa nhôm kính kéo nặng",
      intent: "tìm hiểu vấn đề" as const,
      pain: "Cửa kéo rít, ray bám bụi, bánh xe mòn làm sinh hoạt hằng ngày rất bất tiện.",
      fix: "vệ sinh ray, kiểm tra bánh xe, chỉnh lại cánh và thay phụ kiện chịu tải nếu cần"
    },
    {
      keyword: "vách kính mặt tiền chống rung",
      intent: "tìm hiểu vấn đề" as const,
      pain: "Mặt tiền kính rung khi xe lớn chạy qua, khách lo kính nứt hoặc khung nhanh xuống cấp.",
      fix: "kiểm tra khung đỡ, vị trí bắt vít, ron đệm và loại kính phù hợp kích thước ô"
    }
  ];
  const situations = [
    "nhà mới bàn giao",
    "mặt tiền đang kinh doanh",
    "phòng ngủ cần yên tĩnh",
    "nhà gần đường lớn",
    "cửa sau hay gặp mưa tạt",
    "căn hộ cho thuê cần sửa nhanh"
  ];
  const topic = pickRotated(topics, rowIndex + variationOffset);
  const locality = pickRotated(["Mỹ Tho", "Tiền Giang", "Châu Thành", "Cai Lậy", "Gò Công"], rowIndex + Math.floor(variationOffset / 3));
  const situation = pickRotated(situations, rowIndex + Math.floor(variationOffset / 7));
  const keyword = `${topic.keyword} ${locality}`;
  const title = `${topic.keyword} ${locality}: kiểm tra cho ${situation}`;
  const description = `Cách nhận biết nguyên nhân ${topic.keyword} tại ${locality} cho ${situation}, khi nào nên gọi thợ và thông tin cần chuẩn bị trước khi báo giá.`;
  const slug = slugify(`${keyword} ${situation}`);
  const contextNote = businessContext.split(".")[0]?.trim() || "Cửa Nhôm Kính Xingfa Tiền Giang";

  return {
    thoi_gian: today,
    tu_khoa_chinh: keyword,
    tu_khoa_phu: `${topic.keyword}, cửa nhôm kính ${locality}, sửa cửa nhôm kính, nhôm kính miền Tây`,
    y_dinh_tim_kiem: topic.intent,
    title_seo: title.slice(0, 80),
    meta_description: description,
    h1: `${topic.keyword} tại ${locality}`,
    slug,
    dan_y: `1. Dấu hiệu dễ thấy\n2. Nguyên nhân thường gặp\n3. Cách kiểm tra trước khi gọi thợ\n4. Thông tin cần gửi để báo giá`,
    noi_dung_seo: `${contextNote} thường gặp tình huống ${topic.pain} Trường hợp ${situation} tại ${locality} cần nhìn đúng nguyên nhân trước khi báo giá. Trước khi chốt phương án, nên ${topic.fix}. Khi gửi yêu cầu, khách nên chụp tổng thể ô cửa, quay video thao tác đóng mở và đo sơ bộ chiều ngang, chiều cao. Nhờ vậy thợ có thể tư vấn đúng vật tư, tránh báo giá chung chung hoặc phát sinh sau khi khảo sát.`,
    caption_tiktok: `${situation} ở ${locality} gặp lỗi này thì đừng chỉ bơm thêm keo. Kiểm tra đúng điểm mới xử lý bền. #nhomkinh #cuanhomxingfa #${slugify(locality)}`,
    caption_facebook: `${topic.pain} Với ${situation} ở ${locality}, hãy gửi ảnh hiện trạng và kích thước ô cửa để được tư vấn đúng hệ nhôm, kính và phụ kiện.`,
    kich_ban_video: `Hook 0-3s: quay lỗi thực tế. Problem 3-10s: chỉ điểm ${topic.pain} Solution 10-20s: ${topic.fix}. CTA: gửi ảnh hiện trạng để tư vấn.`,
    hashtag: `#nhomkinh #cuanhomxingfa #cuanhomkinh #${slugify(locality)} #tiengiang`,
    link_nguon: seed.sourceUrl,
    image: imageFormula(seed.imageUrl),
    noi_dau_khach: topic.pain
  };
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

async function readRecentSheetRows(token: string, limit = 80) {
  const sheetName = encodeURIComponent(config.googleSheets.sheetName);
  const result = await sheetsRequest(`/${encodeURIComponent("values")}/${sheetName}!A2:Q?majorDimension=ROWS`, token, {
    method: "GET"
  }) as { values?: string[][] };
  const rows = (result.values || []).slice(-limit);
  return rows.map((values) => ({
    keyword: values[1] || "",
    title: values[4] || "",
    h1: values[6] || "",
    slug: values[7] || "",
    pain: values[16] || ""
  })).filter((row) => row.keyword || row.title || row.slug || row.pain);
}

function buildVariationContext(rowIndex: number, targetRows: number, runKey: string, recentRows: Awaited<ReturnType<typeof readRecentSheetRows>>) {
  const recent = recentRows.slice(-18).map((row) => ({
    keyword: row.keyword,
    title: row.title,
    slug: row.slug,
    pain: row.pain
  }));
  const themes = [
    "dột nước khi mưa lớn",
    "cửa lùa kéo nặng hoặc kẹt ray",
    "cửa nhôm bị xệ cạ nền",
    "vách kính mặt tiền rung",
    "chọn kính cho ô cửa lớn",
    "phụ kiện khóa và bánh xe nhanh hư",
    "cửa nhà vệ sinh chống ẩm",
    "so sánh báo giá theo cấu tạo"
  ];
  return JSON.stringify({
    runKey,
    row: `${rowIndex + 1}/${targetRows}`,
    requiredTheme: pickRotated(themes, rowIndex + hashToNumber(runKey)),
    avoidRecentRows: recent
  });
}

function assertNotRecentDuplicate(row: SheetRow, recentRows: Awaited<ReturnType<typeof readRecentSheetRows>>) {
  const rowSlug = compactText(row.slug);
  const rowTitle = compactText(row.title_seo);
  const rowPain = compactText(row.noi_dau_khach);
  const duplicate = recentRows.find((recent) => {
    const recentSlug = compactText(recent.slug);
    const recentTitle = compactText(recent.title);
    const recentPain = compactText(recent.pain);
    return (
      (rowSlug && rowSlug === recentSlug) ||
      (rowTitle && rowTitle === recentTitle) ||
      (rowPain && rowPain === recentPain)
    );
  });

  if (duplicate) {
    throw new AppError(
      502,
      "AI_RESPONSE_DUPLICATE",
      `AI tạo trùng nội dung gần đây: ${duplicate.title || duplicate.slug || duplicate.pain}`
    );
  }
}

async function writeRows(rows: SheetRow[]) {
  const token = await getGoogleAccessToken();
  const sheetName = encodeURIComponent(config.googleSheets.sheetName);
  const headerRange = `/${encodeURIComponent("values")}/${sheetName}!A1:Q1?valueInputOption=USER_ENTERED`;
  await sheetsRequest(headerRange, token, {
    method: "PUT",
    body: JSON.stringify({ values: [contentSheetColumns] })
  });

  const appendRange = `/${encodeURIComponent("values")}/${sheetName}!A:Q:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  return sheetsRequest(appendRange, token, {
    method: "POST",
    body: JSON.stringify({ values: sheetValues(rows) })
  });
}

export async function runDailyContentRow(rowIndex: number, options: { runKey?: string } = {}) {
  const today = formatVietnamDateTime();
  const day = today.slice(0, 10);
  const runKey = (options.runKey || day).replace(/[^a-zA-Z0-9._:-]/g, "-").slice(0, 80);
  const settings = await getDailySettings();
  const sourceSeeds = settings.sourceSeeds.length ? settings.sourceSeeds : loadSourceSeeds();
  if (!settings.enabled) return { skipped: true, reason: "paused" };
  const targetRows = settings.rowCount;
  if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= targetRows) {
    throw new AppError(400, "INVALID_ROW_INDEX", `rowIndex phải từ 0 đến ${targetRows - 1}.`);
  }

  // A unique daily slot prevents duplicate cron deliveries from writing twice.
  const runSlot = runKey === day ? day : `${day}:${runKey}`;
  let trackRun = true;
  try {
    const claimed = await prisma.dailyContentRun.createMany({
      data: [{ day: runSlot, rowIndex, status: "running" }], skipDuplicates: true
    });
    if (!claimed.count) return { skipped: true, reason: "already_claimed", day: runSlot, rowIndex };
  } catch (error) {
    trackRun = false;
    console.error("daily-content run tracking unavailable; continuing without DB guard", error);
  }
  try {
  const started = Date.now();
  const rotation = Math.floor(Date.now() / 86400000) + hashToNumber(runKey);
  const seed = sourceSeeds[(rotation + rowIndex) % sourceSeeds.length];
  let recentRows: Awaited<ReturnType<typeof readRecentSheetRows>> = [];
  try {
    recentRows = await readRecentSheetRows(await getGoogleAccessToken());
  } catch (error) {
    console.error("daily-content recent sheet read unavailable; continuing without duplicate context", error);
  }
  const variationContext = buildVariationContext(rowIndex, targetRows, runKey, recentRows);
  console.log(`daily-content row ${rowIndex + 1}/${targetRows} start`);

  let batch: SheetRow[] | null = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const prompt =
        attempt === 1
          ? `${dailyPrompt(today, [seed], 1, settings.businessContext, variationContext)}\nRow index: ${rowIndex + 1}/${targetRows}. Distinct angle.`
          : `${dailyPrompt(today, [seed], 1, settings.businessContext, variationContext)}\nReturn ONLY valid JSON, first char {. No prose.\n{"rows":[{${contentSheetColumns.map((f) => `"${f}":"..."`).join(",")}}]}\nthoi_gian="${today}". Use this seed: ${JSON.stringify(seed)}. Do not repeat avoidRecentRows.`;
      const outputText = await callAi(prompt);
      batch = parseAiRows(outputText);
      if (batch.length !== 1) {
        throw new AppError(502, "AI_RESPONSE_INVALID", `AI trả ${batch.length} dòng, cần 1 dòng.`);
      }
      assertNotRecentDuplicate(batch[0], recentRows);
      break;
    } catch (error) {
      console.error(`daily-content row ${rowIndex + 1} attempt ${attempt} failed`, error);
    }
  }

  if (!batch) {
    batch = [fallbackRow(today, seed, rowIndex, settings.businessContext, hashToNumber(runKey))];
  }

  // Keep the server's date authoritative, including when the AI returns a different date.
  batch[0].thoi_gian = today;
  await writeRows(batch);
  if (trackRun) {
    await prisma.dailyContentRun.update({ where: { day_rowIndex: { day: runSlot, rowIndex } }, data: { status: "succeeded" } });
  }
  console.log(`daily-content row ${rowIndex + 1}/${targetRows} written in ${Date.now() - started}ms`);

  return {
    spreadsheetId: config.googleSheets.spreadsheetId,
    sheetName: config.googleSheets.sheetName,
    rowIndex,
    rowCount: 1,
    mode: "append",
    runKey,
    generatedAt: today
  };
  } catch (error) {
    if (trackRun) {
      await prisma.dailyContentRun.update({ where: { day_rowIndex: { day: runSlot, rowIndex } },
        data: { status: "failed", message: error instanceof AppError ? error.code : "DAILY_CONTENT_FAILED" } });
    }
    throw error;
  }
}

/** Run N parallel row workers (each is its own serverless invocation). */
export async function runDailyContentRowJobsWork(origin: string, runKey?: string) {
  const settings = await getDailySettings();
  const targetRows = settings.enabled ? settings.rowCount : 0;
  const secret = config.dailyContent.cronSecret.trim();
  const base = origin.replace(/\/+$/, "");
  const authHeaders: Record<string, string> = secret
    ? { Authorization: `Bearer ${secret}` }
    : { "x-vercel-cron": "1", "User-Agent": "vercel-cron/1.0" };

  return Promise.allSettled(
    Array.from({ length: targetRows }, (_, index) =>
      fetch(`${base}/api/cron/daily-content-row?index=${index}${runKey ? `&run=${encodeURIComponent(runKey)}` : ""}`, {
        method: "GET",
        headers: authHeaders
      }).then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
        if (!response.ok) {
          throw new AppError(
            response.status,
            body?.error || "ROW_JOB_FAILED",
            body?.message || `Row ${index} failed with HTTP ${response.status}.`
          );
        }
        return body;
      })
    )
  );
}

export async function enqueueDailyContentRowJobs(origin: string, runKey?: string) {
  const settings = await getDailySettings();
  const targetRows = settings.enabled ? settings.rowCount : 0;
  return {
    triggered: targetRows,
    rowIndexes: Array.from({ length: targetRows }, (_, index) => index),
    runKey,
    work: runDailyContentRowJobsWork(origin, runKey)
  };
}

export async function awaitDailyContentRowJobs(origin: string, runKey?: string) {
  const results = await runDailyContentRowJobsWork(origin, runKey);
  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failures = results
    .map((r, index) => (r.status === "rejected" ? { index, reason: String(r.reason) } : null))
    .filter(Boolean);

  if (succeeded === 0) {
    throw new AppError(
      502,
      "DAILY_CONTENT_ALL_ROWS_FAILED",
      failures.map((f) => f?.reason).join(" | ") || "All row jobs failed."
    );
  }

  return { triggered: results.length, succeeded, failed: failures.length, failures };
}

export function resolvePublicOrigin(forwardedHost?: string, host?: string, forwardedProto?: string) {
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  const hostname = forwardedHost || host || "127.0.0.1:3000";
  const proto = forwardedProto || (hostname.includes("localhost") || hostname.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${hostname}`;
}

export async function runDailyContentJob(origin?: string) {
  return awaitDailyContentRowJobs(origin || resolvePublicOrigin());
}

function normalizeCronSecret(input: string | string[] | undefined) {
  if (Array.isArray(input)) {
    input = input[0];
  }
  if (!input) {
    return undefined;
  }
  const match = input.match(/^Bearer\s+(.+)$/i);
  return (match?.[1] || input).trim();
}

type CronAuthRequest = {
  headers?: Record<string, string | string[] | undefined>;
  header?: (name: string) => string | undefined;
};

function headerValue(req: CronAuthRequest, name: string) {
  if (typeof req.header === "function") {
    return req.header(name) || req.header(name.toLowerCase());
  }
  const headers = req.headers || {};
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

/** Accept Vercel scheduler (auto Bearer CRON_SECRET / cron headers) or manual secret. */
export function assertCronSecret(input: string | undefined) {
  assertCronAuth({ headers: { authorization: input } });
}

export function assertCronAuth(req: CronAuthRequest) {
  const expected = config.dailyContent.cronSecret.trim();
  const provided =
    normalizeCronSecret(headerValue(req, "authorization")) ||
    normalizeCronSecret(headerValue(req, "x-cron-secret"));
  if (expected && provided === expected) return;
  if (!expected) {
    throw new AppError(503, "CRON_SECRET_NOT_CONFIGURED", "Thiếu CRON_SECRET để bảo vệ endpoint cron.");
  }
  throw new AppError(401, "UNAUTHORIZED", "Cron secret không đúng.");
}
