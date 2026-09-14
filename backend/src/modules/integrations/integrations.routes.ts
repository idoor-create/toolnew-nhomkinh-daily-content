import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { createFacebookConnectUrl, handleFacebookCallback, listFacebookPages } from "./facebook.service.js";
import { createTiktokConnectUrl, handleTiktokCallback } from "./tiktok.service.js";

export const integrationsRouter = Router();

const idParamSchema = z.coerce.number().int().positive();

integrationsRouter.get("/customers/:id/facebook/start", requireAuth, async (req, res, next) => {
  try {
    const customerId = idParamSchema.parse(req.params.id);
    res.json(await createFacebookConnectUrl(customerId));
  } catch (error) {
    next(error);
  }
});

integrationsRouter.get("/customers/:id/facebook/pages", requireAuth, async (req, res, next) => {
  try {
    const customerId = idParamSchema.parse(req.params.id);
    res.json(await listFacebookPages(customerId));
  } catch (error) {
    next(error);
  }
});

integrationsRouter.get("/customers/:id/tiktok/start", requireAuth, async (req, res, next) => {
  try {
    const customerId = idParamSchema.parse(req.params.id);
    res.json(await createTiktokConnectUrl(customerId));
  } catch (error) {
    next(error);
  }
});

integrationsRouter.get("/facebook/callback", async (req, res, next) => {
  try {
    const customer = await handleFacebookCallback({
      code: typeof req.query.code === "string" ? req.query.code : undefined,
      state: typeof req.query.state === "string" ? req.query.state : undefined
    });

    res.type("html").send(`
      <!doctype html>
      <meta charset="utf-8" />
      <title>Facebook connected</title>
      <body style="font-family: system-ui, sans-serif; padding: 32px;">
        <h1>Đã kết nối Facebook</h1>
        <p>Kênh ID: ${customer.customerId}</p>
        <p>Đã kết nối ${customer.pages.length} Fanpage.</p>
        <p>Bạn có thể đóng tab này và quay lại trang Kênh.</p>
      </body>
    `);
  } catch (error) {
    next(error);
  }
});

integrationsRouter.get("/tiktok/callback", async (req, res, next) => {
  try {
    const connection = await handleTiktokCallback({
      code: typeof req.query.code === "string" ? req.query.code : undefined,
      state: typeof req.query.state === "string" ? req.query.state : undefined,
      error: typeof req.query.error === "string" ? req.query.error : undefined,
      errorDescription: typeof req.query.error_description === "string" ? req.query.error_description : undefined
    });

    res.type("html").send(`
      <!doctype html>
      <meta charset="utf-8" />
      <title>TikTok connected</title>
      <body style="font-family: system-ui, sans-serif; padding: 32px;">
        <h1>Đã kết nối TikTok</h1>
        <p>Kênh ID: ${connection.customerId}</p>
        <p>Profile: ${connection.profile.displayName}</p>
        <p>Bạn có thể đóng tab này và quay lại trang Kênh.</p>
      </body>
    `);
  } catch (error) {
    next(error);
  }
});
