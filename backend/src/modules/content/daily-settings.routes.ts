import { Router } from "express";
import { config } from "../../config.js";
import { AppError } from "../../middleware/error.js";
import { prisma } from "../../lib/prisma.js";
import { ensureDailyContentTables, getDailySettings, saveDailySettings } from "./daily-settings.service.js";

export const dailySettingsRouter = Router();

dailySettingsRouter.get("/", async (_req, res, next) => {
  try {
    const settings = await getDailySettings();
    const runs = await (async () => {
      try {
        await ensureDailyContentTables();
        return await prisma.dailyContentRun.findMany({ orderBy: { createdAt: "desc" }, take: 30 });
      } catch (error) {
        console.error("daily-settings runs unavailable", error);
        return [];
      }
    })();
    res.json({ settings, runs, sheetUrl: `https://docs.google.com/spreadsheets/d/${config.googleSheets.spreadsheetId}/edit`,
      sheetName: config.googleSheets.sheetName, schedule: "08:00 hằng ngày (giờ Việt Nam)",
      connections: { ai: Boolean(config.openai.apiKey), google: Boolean(config.googleSheets.serviceAccountEmail && config.googleSheets.privateKey), cron: Boolean(config.dailyContent.cronSecret) }
    });
  } catch (error) { next(error); }
});

dailySettingsRouter.put("/", async (req, res, next) => {
  try { res.json({ settings: await saveDailySettings(req.body) }); }
  catch (error) { next(error); }
});

dailySettingsRouter.post("/run-now", async (req, res, next) => {
  try {
    const secret = config.dailyContent.cronSecret.trim();
    if (!secret) {
      throw new AppError(503, "CRON_SECRET_NOT_CONFIGURED", "Thiếu CRON_SECRET để chạy cập nhật ngay.");
    }
    const forwardedHost = req.header("x-forwarded-host") || req.header("host") || "127.0.0.1:3000";
    const forwardedProto = req.header("x-forwarded-proto") || (forwardedHost.includes("localhost") ? "http" : "https");
    const origin = process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : `${forwardedProto}://${forwardedHost}`;
    const runKey = `manual-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 8)}`;
    const response = await fetch(`${origin.replace(/\/+$/, "")}/api/cron/daily-content?run=${encodeURIComponent(runKey)}`, {
      headers: { Authorization: `Bearer ${secret}` }
    });
    const body = await response.json().catch(() => ({}));
    res.status(response.status).json({ ...body, runKey });
  } catch (error) {
    next(error);
  }
});
