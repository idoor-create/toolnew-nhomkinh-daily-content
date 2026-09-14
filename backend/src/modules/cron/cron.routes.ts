import { Router } from "express";
import { AppError } from "../../middleware/error.js";
import { assertCronSecret, runDailyContentJob } from "../content/daily-content.service.js";

export const cronRouter = Router();

function logCronError(error: unknown) {
  if (error instanceof AppError) {
    console.error("daily-content cron failed", {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message
    });
    return;
  }

  console.error("daily-content cron failed", {
    message: error instanceof Error ? error.message : String(error)
  });
}

function secretFromRequest(value: string | undefined) {
  if (!value) return undefined;
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || value;
}

cronRouter.get("/daily-content", async (req, res, next) => {
  try {
    assertCronSecret(secretFromRequest(req.header("authorization")) || req.header("x-cron-secret"));
    const result = await runDailyContentJob();
    res.json({ ok: true, result });
  } catch (error) {
    logCronError(error);
    next(error);
  }
});

cronRouter.post("/daily-content", async (req, res, next) => {
  try {
    assertCronSecret(secretFromRequest(req.header("authorization")) || req.header("x-cron-secret"));
    const result = await runDailyContentJob();
    res.json({ ok: true, result });
  } catch (error) {
    logCronError(error);
    next(error);
  }
});
