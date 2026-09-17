import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { config } from "../../config.js";

export const sourceSeedSchema = z.object({
  platform: z.enum(["facebook", "tiktok", "website", "other"]),
  sourceUrl: z.string().trim().url(),
  sourceTitle: z.string().trim().min(3).max(240),
  imageUrl: z.string().trim().url(),
  notes: z.string().trim().min(1).max(1000)
}).strict();

export const dailySettingsSchema = z.object({
  enabled: z.boolean(),
  rowCount: z.number().int().min(1).max(10),
  businessContext: z.string().trim().min(20).max(8000),
  sourceSeeds: z.array(sourceSeedSchema).min(1).max(20)
}).strict();

let ensureTablesPromise: Promise<void> | null = null;
const settingsSheetName = process.env.DAILY_CONTENT_CONFIG_SHEET_NAME?.trim() || "AI_Config";

type DailySettingsInput = z.infer<typeof dailySettingsSchema>;

function parseEnvSourceSeeds() {
  if (!config.dailyContent.sourceSeedsJson) return [];
  try {
    const parsed = z.array(sourceSeedSchema).safeParse(JSON.parse(config.dailyContent.sourceSeedsJson));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function defaultDailySettings() {
  return {
    id: 1,
    enabled: true,
    rowCount: Math.min(config.dailyContent.rowCount, 10),
    businessContext: config.dailyContent.businessContext,
    sourceSeeds: parseEnvSourceSeeds(),
    updatedAt: null
  };
}

function isDatabaseReachabilityError(error: unknown) {
  return error instanceof Error && /can't reach database server|P1001/i.test(error.message);
}

export async function ensureDailyContentTables() {
  ensureTablesPromise ||= (async () => {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "DailyContentSettings" (
        "id" INTEGER NOT NULL DEFAULT 1,
        "enabled" BOOLEAN NOT NULL DEFAULT true,
        "rowCount" INTEGER NOT NULL DEFAULT 3,
        "businessContext" TEXT NOT NULL,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "DailyContentSettings_pkey" PRIMARY KEY ("id")
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "DailyContentRun" (
        "id" SERIAL NOT NULL,
        "day" TEXT NOT NULL,
        "rowIndex" INTEGER NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'running',
        "message" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "DailyContentRun_pkey" PRIMARY KEY ("id")
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "DailyContentRun_day_rowIndex_key"
      ON "DailyContentRun" ("day", "rowIndex")
    `);
  })();

  return ensureTablesPromise;
}

function base64url(value: Buffer | string) {
  return Buffer.from(value).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getGoogleAccessToken() {
  const { serviceAccountEmail, privateKey } = config.googleSheets;
  if (!serviceAccountEmail || !privateKey) return null;

  const now = Math.floor(Date.now() / 1000);
  const unsignedJwt = `${base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64url(JSON.stringify({
    iss: serviceAccountEmail,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  }))}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsignedJwt);
  signer.end();
  const assertion = `${unsignedJwt}.${base64url(signer.sign(privateKey))}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  const result = (await response.json().catch(() => ({}))) as { access_token?: string };
  return response.ok ? result.access_token || null : null;
}

async function sheetsRequest(path: string, token: string, init: RequestInit = {}) {
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
    throw new Error(JSON.stringify(result));
  }
  return result;
}

async function ensureSettingsSheet(token: string) {
  const meta = await sheetsRequest("?fields=sheets.properties.title", token) as {
    sheets?: Array<{ properties?: { title?: string } }>;
  };
  const exists = meta.sheets?.some((sheet) => sheet.properties?.title === settingsSheetName);
  if (exists) return;

  await sheetsRequest(":batchUpdate", token, {
    method: "POST",
    body: JSON.stringify({
      requests: [{ addSheet: { properties: { title: settingsSheetName } } }]
    })
  });
}

async function readSheetSettings() {
  const token = await getGoogleAccessToken();
  if (!token) return null;

  try {
    const result = await sheetsRequest(`/values/${encodeURIComponent(settingsSheetName)}!A:B`, token) as {
      values?: string[][];
    };
    const values = new Map((result.values || []).slice(1).map((row) => [row[0], row[1] || ""]));
    if (!values.size) return null;

    const parsed = dailySettingsSchema.safeParse({
      enabled: values.get("enabled") !== "false",
      rowCount: Number(values.get("rowCount") || config.dailyContent.rowCount),
      businessContext: values.get("businessContext") || config.dailyContent.businessContext,
      sourceSeeds: JSON.parse(values.get("sourceSeeds") || "[]")
    });
    return parsed.success ? { id: 1, ...parsed.data, updatedAt: values.get("updatedAt") || null } : null;
  } catch (error) {
    console.error("daily-settings sheet read unavailable", error);
    return null;
  }
}

async function writeSheetSettings(data: DailySettingsInput) {
  const token = await getGoogleAccessToken();
  if (!token) return;
  await ensureSettingsSheet(token);
  await sheetsRequest(`/values/${encodeURIComponent(settingsSheetName)}!A1:B6?valueInputOption=USER_ENTERED`, token, {
    method: "PUT",
    body: JSON.stringify({
      values: [
        ["key", "value"],
        ["enabled", String(data.enabled)],
        ["rowCount", String(data.rowCount)],
        ["businessContext", data.businessContext],
        ["sourceSeeds", JSON.stringify(data.sourceSeeds)],
        ["updatedAt", new Date().toISOString()]
      ]
    })
  });
}

export async function getDailySettings() {
  const sheetSettings = await readSheetSettings();
  if (sheetSettings) return sheetSettings;

  try {
    await ensureDailyContentTables();
    const stored = await prisma.dailyContentSettings.findUnique({ where: { id: 1 } });
    return stored ? { ...defaultDailySettings(), ...stored } : defaultDailySettings();
  } catch (error) {
    if (isDatabaseReachabilityError(error)) {
      console.error("daily-settings database unavailable; using env defaults", error);
      return defaultDailySettings();
    }
    throw error;
  }
}

export async function saveDailySettings(input: unknown) {
  const data = dailySettingsSchema.parse(input);
  await writeSheetSettings(data);

  try {
    await ensureDailyContentTables();
    const { sourceSeeds: _sourceSeeds, ...dbData } = data;
    await prisma.dailyContentSettings.upsert({ where: { id: 1 }, create: { id: 1, ...dbData }, update: dbData });
  } catch (error) {
    if (!isDatabaseReachabilityError(error)) throw error;
    console.error("daily-settings database unavailable; saved settings to Google Sheet only", error);
  }

  return { id: 1, ...data, updatedAt: new Date() };
}
