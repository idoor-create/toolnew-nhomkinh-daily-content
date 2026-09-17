import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { AppError } from "../../middleware/error.js";
import {
  assertCronAuth,
  enqueueDailyContentRowJobs,
  resolvePublicOrigin,
  runDailyContentRow
} from "../content/daily-content.service.js";

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

async function handleDailyContentOrchestrator(req: Request, res: Response, next: NextFunction) {
  try {
    assertCronAuth(req);
    const runKey = typeof req.query.run === "string" ? req.query.run : undefined;
    const origin = resolvePublicOrigin(
      req.header("x-forwarded-host") || undefined,
      req.header("host") || undefined,
      req.header("x-forwarded-proto") || undefined
    );
    const { triggered, rowIndexes, work } = await enqueueDailyContentRowJobs(origin, runKey);
    void work.catch((error) => logCronError(error));
    res.status(202).json({ ok: true, mode: "split_parallel", triggered, rowIndexes, runKey });
  } catch (error) {
    logCronError(error);
    next(error);
  }
}

async function handleDailyContentRow(req: Request, res: Response, next: NextFunction) {
  try {
    assertCronAuth(req);
    const rowIndex = Number(req.query.index);
    const runKey = typeof req.query.run === "string" ? req.query.run : undefined;
    const result = await runDailyContentRow(rowIndex, { runKey });
    res.json({ ok: true, result });
  } catch (error) {
    logCronError(error);
    next(error);
  }
}

cronRouter.get("/daily-content", handleDailyContentOrchestrator);
cronRouter.post("/daily-content", handleDailyContentOrchestrator);
cronRouter.get("/daily-content-row", handleDailyContentRow);
cronRouter.post("/daily-content-row", handleDailyContentRow);
