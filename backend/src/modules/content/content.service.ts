import { z } from "zod";
import { config } from "../../config.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../middleware/error.js";

const sheetFields = [
  "thoi_gian",
  "tu_khoa_chinh",
  "tu_khoa_phu",
  "y_dinh_tim_kiem",
  "title_seo",
  "meta_description",
  "h1",
  "slug",
  "dan_y",
  "noi_dung_seo",
  "caption_tiktok",
  "caption_facebook",
  "kich_ban_video",
  "hashtag",
  "link_nguon",
  "image",
  "noi_dau_khach"
] as const;

const referenceSchema = z.object({
  customerId: z.coerce.number().int().positive(),
  platform: z.enum(["facebook", "tiktok", "instagram", "other"]),
  sourceUrl: z.string().trim().url(),
  sourceTitle: z.string().trim().min(3).max(180),
  sourceImageUrl: z.string().trim().url().optional().nullable(),
  originalImageUrl: z.string().trim().url().optional().nullable(),
  views: z.coerce.number().int().nonnegative().optional().nullable(),
  reactions: z.coerce.number().int().nonnegative().optional().nullable(),
  comments: z.coerce.number().int().nonnegative().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable()
});

const generateSchema = z.object({
  customerId: z.coerce.number().int().positive(),
  referenceIds: z.array(z.coerce.number().int().positive()).min(1).max(8),
  primaryKeyword: z.string().trim().min(3).max(120),
  secondaryKeywords: z.string().trim().max(300).default(""),
  searchIntent: z.string().trim().min(3).max(300),
  businessContext: z.string().trim().min(10).max(2000),
  originalImageUrl: z.string().trim().url().optional().nullable(),
  publishAt: z.string().trim().datetime({ offset: true }).optional().nullable()
});

const sheetRowSchema = z.object({
  thoi_gian: z.string(),
  tu_khoa_chinh: z.string(),
  tu_khoa_phu: z.string(),
  y_dinh_tim_kiem: z.string(),
  title_seo: z.string(),
  meta_description: z.string(),
  h1: z.string(),
  slug: z.string(),
  dan_y: z.string(),
  noi_dung_seo: z.string(),
  caption_tiktok: z.string(),
  caption_facebook: z.string(),
  kich_ban_video: z.string(),
  hashtag: z.string(),
  link_nguon: z.string(),
  image: z.string(),
  noi_dau_khach: z.string()
}).strict();

type SheetRow = z.infer<typeof sheetRowSchema>;

function nullable(value: string | null | undefined) {
  return value?.trim() || null;
}

function isTemporaryImageUrl(value: string | null | undefined) {
  if (!value) return false;
  return /(?:scontent|fbcdn|_nc_|[?&](?:oe|oh|expires?|sig|token|X-Amz-[^=]+)=)/i.test(value);
}

function requireStableImageUrl(value: string | null | undefined, label: string) {
  if (isTemporaryImageUrl(value)) {
    throw new AppError(
      400,
      "IMAGE_URL_UNSTABLE",
      `${label} đang là link tạm/CDN có thể hết hạn. Hãy upload ảnh thật lên Google Drive hoặc server ổn định rồi dùng link public.`
    );
  }
}

function isSpecificSourceUrl(value: string) {
  try {
    const url = new URL(value);
    const segments = url.pathname.split("/").filter(Boolean);
    const lowerPath = url.pathname.toLowerCase();
    const query = url.searchParams;
    const hasSpecificQuery = ["story_fbid", "fbid", "v", "photo_id"].some((key) => query.has(key));
    const hasPfbid = segments.some((segment) => /^pfbid/i.test(segment));
    const specificSectionIndex = segments.findIndex((segment) => /^(?:posts?|videos?|reel|photos?|permalink)$/i.test(segment));
    const hasSpecificSection = specificSectionIndex >= 0 && segments.length > specificSectionIndex + 1;
    const hasWatchPath = /\/watch\b/i.test(lowerPath) && query.has("v");
    const hasPostMarker = hasSpecificQuery || hasPfbid || hasSpecificSection || hasWatchPath;

    if (hasPostMarker) return true;
    if (segments.length === 0) return false;
    if (segments.length === 1 && !/\d|[-_]/.test(segments[0])) return false;
    return segments.join("/").length >= 12;
  } catch {
    return false;
  }
}

function requireSpecificSourceUrl(value: string) {
  if (!isSpecificSourceUrl(value)) {
    throw new AppError(
      400,
      "SOURCE_URL_GENERIC",
      "Link nguồn cần là bài/post/video/bài viết cụ thể, không dùng homepage hoặc fanpage chung chung."
    );
  }
}

function normalizePainPoint(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function lineCount(value: string) {
  return value.split(/\n+/).map((line) => line.trim()).filter(Boolean).length;
}

function formatVietnamDateTime(value: string | null | undefined) {
  const date = value ? new Date(value) : new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(Number.isNaN(date.getTime()) ? new Date() : date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

function extractRecentPainPoints(drafts: Array<{ sheetRow: string }>) {
  return drafts.flatMap((draft) => {
    try {
      const row = sheetRowSchema.parse(JSON.parse(draft.sheetRow));
      return row.noi_dau_khach.trim() ? [row.noi_dau_khach.trim()] : [];
    } catch {
      return [];
    }
  });
}

function stableImageFromInput(data: z.infer<typeof generateSchema>, references: Awaited<ReturnType<typeof listReferences>>) {
  return data.originalImageUrl
    || references.find((reference) => reference.originalImageUrl)?.originalImageUrl
    || references.find((reference) => reference.sourceImageUrl)?.sourceImageUrl
    || "";
}

function validateGeneratedRow(row: SheetRow, recentPainPoints: string[], fallbackImage: string, publishTime: string) {
  row.thoi_gian = publishTime;
  if (row.title_seo.length > 65) {
    throw new AppError(502, "AI_RESPONSE_INVALID", "AI cần giữ title_seo dưới 65 ký tự.");
  }
  if (row.meta_description.length < 140 || row.meta_description.length > 170) {
    throw new AppError(502, "AI_RESPONSE_INVALID", "AI cần viết meta_description khoảng 150-160 ký tự.");
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug.trim())) {
    throw new AppError(502, "AI_RESPONSE_INVALID", "AI cần trả về slug lowercase ASCII, cách nhau bằng dấu gạch ngang.");
  }
  const outlineLines = lineCount(row.dan_y);
  if (outlineLines < 3 || outlineLines > 5) {
    throw new AppError(502, "AI_RESPONSE_INVALID", "AI cần trả về dan_y gồm 3-5 ý ngắn.");
  }
  const seoWords = wordCount(row.noi_dung_seo);
  if (seoWords < 280 || seoWords > 540) {
    throw new AppError(502, "AI_RESPONSE_INVALID", "AI cần viết noi_dung_seo khoảng 300-500 từ.");
  }
  if (wordCount(row.caption_tiktok) > 160) {
    throw new AppError(502, "AI_RESPONSE_INVALID", "AI cần giữ caption_tiktok ngắn, tối đa khoảng 150 từ.");
  }
  if (!/(0\s*-\s*3|0-3|3\s*-\s*10|3-10|10\s*-\s*20|10-20)/.test(row.kich_ban_video)) {
    throw new AppError(502, "AI_RESPONSE_INVALID", "AI cần chia kich_ban_video theo mốc giây Hook 0-3s, Problem 3-10s, Solution 10-20s và CTA.");
  }
  if (!["tìm hiểu vấn đề", "so sánh giá", "tìm thợ sửa gấp"].includes(row.y_dinh_tim_kiem.trim())) {
    throw new AppError(502, "AI_RESPONSE_INVALID", "AI cần chọn đúng một y_dinh_tim_kiem: tìm hiểu vấn đề, so sánh giá, hoặc tìm thợ sửa gấp.");
  }

  const sourceUrls = row.link_nguon.match(/https?:\/\/[^\s,;]+/g)?.map((url) => url.replace(/[).]+$/, "")) || [];
  if (sourceUrls.length === 0) {
    throw new AppError(502, "AI_RESPONSE_INVALID", "AI cần trả về link_nguon là link bài/post/video/bài viết cụ thể.");
  }
  sourceUrls.forEach(requireSpecificSourceUrl);
  requireStableImageUrl(row.image, "Ảnh trong cột image");
  if (!row.image && fallbackImage) {
    row.image = fallbackImage;
  }

  const hashtagCount = row.hashtag.split(/\s+/).filter((item) => item.startsWith("#")).length;
  if (hashtagCount < 3 || hashtagCount > 6) {
    throw new AppError(502, "AI_RESPONSE_INVALID", "AI cần trả về 3-6 hashtag địa phương/vấn đề, không dùng bộ hashtag lặp cố định.");
  }

  const normalizedPain = normalizePainPoint(row.noi_dau_khach);
  if (!normalizedPain) {
    throw new AppError(502, "AI_RESPONSE_INVALID", "AI cần trả về noi_dau_khach là một câu vấn đề quan sát được.");
  }
  if (recentPainPoints.map(normalizePainPoint).includes(normalizedPain)) {
    throw new AppError(502, "AI_RESPONSE_DUPLICATE", "AI tạo trùng noi_dau_khach với các dòng gần nhất. Hãy đổi góc đau khách hoặc khu vực.");
  }
}

function parseIds(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is number => Number.isInteger(id)) : [];
  } catch {
    return [];
  }
}

function draftResponse(draft: { referenceIds: string; sheetRow: string } & Record<string, unknown>) {
  return {
    ...draft,
    referenceIds: parseIds(draft.referenceIds),
    sheetRow: sheetRowSchema.parse(JSON.parse(draft.sheetRow))
  };
}

export async function listReferences(customerId: number) {
  return prisma.contentReference.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" }
  });
}

export async function createReference(input: unknown) {
  const data = referenceSchema.parse(input);
  requireSpecificSourceUrl(data.sourceUrl);
  requireStableImageUrl(data.sourceImageUrl, "Ảnh nguồn URL");
  requireStableImageUrl(data.originalImageUrl, "Ảnh gốc/công trình URL");

  const customer = await prisma.customer.findUnique({ where: { id: data.customerId }, select: { id: true } });
  if (!customer) {
    throw new AppError(404, "NOT_FOUND", "Customer not found.");
  }

  return prisma.contentReference.create({
    data: {
      ...data,
      sourceImageUrl: nullable(data.sourceImageUrl),
      originalImageUrl: nullable(data.originalImageUrl),
      notes: nullable(data.notes)
    }
  });
}

export async function listDrafts(customerId: number) {
  const drafts = await prisma.contentDraft.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    take: 30
  });
  return drafts.map(draftResponse);
}

function instructions(
  input: z.infer<typeof generateSchema>,
  references: Awaited<ReturnType<typeof listReferences>>,
  recentPainPoints: string[],
  publishTime: string
) {
  const compactReferences = references.map((reference) => ({
    platform: reference.platform,
    sourceTitle: reference.sourceTitle,
    sourceUrl: reference.sourceUrl,
    sourceImageUrl: reference.sourceImageUrl,
    originalImageUrl: reference.originalImageUrl,
    views: reference.views,
    reactions: reference.reactions,
    comments: reference.comments,
    notes: reference.notes
  }));

  return `You are a Vietnamese local SEO and Facebook sales strategist for aluminum-glass construction services in Southern Vietnam.
Create one ORIGINAL content plan for a Vietnamese business. Use the reference posts only to learn audience hooks, format, and topic gaps. Never copy their wording, distinctive claims, or copyrighted copy. Do not invent project facts, prices, customer testimonials, certifications, warranty terms, completion speed, or performance metrics. Use only the supplied images; leave image fields empty when no suitable real image exists.

Business context: ${input.businessContext}
Primary keyword: ${input.primaryKeyword}
Secondary keywords: ${input.secondaryKeywords || "None supplied"}
Search intent: ${input.searchIntent}
Publish time: ${publishTime}
Original image URL selected by user: ${input.originalImageUrl || ""}
Reference posts: ${JSON.stringify(compactReferences)}
Recent pain points to avoid repeating exactly or semantically: ${JSON.stringify(recentPainPoints)}

Return JSON only. The object must include exactly these fields: ${sheetFields.join(", ")}.
Column rules:
- thoi_gian: exactly "${publishTime}" in YYYY-MM-DD HH:mm format. Never empty.
- tu_khoa_chinh: one service plus one specific locality. Rotate localities such as My Tho, Go Cong, Cai Lay, Chau Thanh, Tien Giang, and nearby Mekong Delta areas.
- tu_khoa_phu: 3-5 related keywords tied to noi_dau_khach, separated by comma.
- y_dinh_tim_kiem: choose exactly one of "tìm hiểu vấn đề", "so sánh giá", "tìm thợ sửa gấp".
- title_seo: include primary keyword and a practical buyer element; keep under 65 characters.
- meta_description: 150-160 characters, problem plus solution direction, no filler.
- h1: same search idea as title_seo but more natural; do not copy title exactly.
- slug: lowercase ASCII, hyphenated, accurate to the keyword/locality.
- dan_y: 3-5 short bullet/numbered ideas, not a paragraph.
- noi_dung_seo: 300-500 Vietnamese words, follows dan_y, includes at least one real technical cause explanation such as frame misalignment, drainage hole blockage, poor silicone finishing, worn hinge/lock, wrong glass/aluminum thickness, or inaccurate wall-opening measurement.
- caption_tiktok: short, spoken rhythm, first sentence is a pain hook, max about 150 words.
- caption_facebook: first line is a pain hook; CTA asks for location, width x height, opening direction, and a real photo/video; structure must differ from TikTok.
- kich_ban_video: split by seconds using this shape: Hook 0-3s -> Problem 3-10s -> Solution 10-20s -> CTA.
- hashtag: 3-6 local/problem hashtags, no fixed repeated set.
- link_nguon: use only specific post/video/article URLs from the supplied references; never root domain, homepage, or fanpage-only URL.
- image: stable public URL only, preferably Google Drive direct view such as https://drive.google.com/uc?export=view&id=...; never use scontent, fbcdn, _nc_, expiring tokens, or bad hash URLs.
- noi_dau_khach: one specific observable sentence inspired by real source context, not a broad generic complaint.

Writing rules:
- Write all values in Vietnamese for buyers in the South of Vietnam and the Mekong Delta.
- Use plain, respectful local wording; never caricature dialect.
- Do not invent project facts, prices, testimonials, certifications, warranty terms, completion speed, or performance metrics.
- Use reference posts only to learn audience hooks and topic gaps. Never copy wording.
- Prefer technical proof points a real shop can verify: measure wall opening, compare aluminum profile/glass/accessory/labor lines, inspect gaps, hinges, locks, silicone seams, drainage holes, and finished photos.
- If two selected references point to the same pain, choose a different locality or technical cause so the row still feels fresh.`;
}

export async function generateDraft(input: unknown) {
  const data = generateSchema.parse(input);
  requireStableImageUrl(data.originalImageUrl, "Ảnh gốc ưu tiên");

  if (!config.openai.apiKey) {
    throw new AppError(503, "AI_NOT_CONFIGURED", "Thiếu AI_API_KEY hoặc OPENAI_API_KEY trên backend để tạo nội dung AI.");
  }

  const [references, recentDrafts] = await Promise.all([
    prisma.contentReference.findMany({
      where: { customerId: data.customerId, id: { in: data.referenceIds } }
    }),
    prisma.contentDraft.findMany({
      where: { customerId: data.customerId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { sheetRow: true }
    })
  ]);
  if (references.length !== data.referenceIds.length) {
    throw new AppError(400, "REFERENCE_INVALID", "Một hoặc nhiều bài nguồn không thuộc hồ sơ đã chọn.");
  }
  references.forEach((reference) => {
    requireSpecificSourceUrl(reference.sourceUrl);
    requireStableImageUrl(reference.sourceImageUrl, "Ảnh nguồn URL");
    requireStableImageUrl(reference.originalImageUrl, "Ảnh gốc/công trình URL");
  });

  const recentPainPoints = extractRecentPainPoints(recentDrafts);
  const publishTime = formatVietnamDateTime(data.publishAt);

  const apiBaseUrl = config.openai.baseUrl.replace(/\/+$/, "");
  const response = await fetch(`${apiBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openai.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.openai.model,
      messages: [{ role: "user", content: instructions(data, references, recentPainPoints, publishTime) }],
      response_format: { type: "json_object" }
    })
  });
  const result = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
  const outputText = result.choices?.[0]?.message?.content;
  if (!response.ok || !outputText) {
    throw new AppError(502, "AI_GENERATION_FAILED", result.error?.message || "AI did not return a structured content row.");
  }

  let row: SheetRow;
  try {
    row = sheetRowSchema.parse(JSON.parse(outputText));
  } catch {
    throw new AppError(502, "AI_RESPONSE_INVALID", "AI returned a row that does not match the Google Sheet format.");
  }
  validateGeneratedRow(row, recentPainPoints, stableImageFromInput(data, references), publishTime);

  const draft = await prisma.contentDraft.create({
    data: {
      customerId: data.customerId,
      referenceIds: JSON.stringify(data.referenceIds),
      sheetRow: JSON.stringify(row)
    }
  });
  return draftResponse(draft);
}

export const contentSheetColumns = sheetFields;
