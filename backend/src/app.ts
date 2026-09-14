import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { config } from "./config.js";
import { requireAuth } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { customersRouter } from "./modules/customers/customers.routes.js";
import { integrationsRouter } from "./modules/integrations/integrations.routes.js";
import { postsRouter } from "./modules/posts/posts.routes.js";
import { contentRouter } from "./modules/content/content.routes.js";
import { cronRouter } from "./modules/cron/cron.routes.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: config.frontendOrigins,
      credentials: true
    })
  );
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use(
    "/api/auth/login",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 20,
      standardHeaders: true,
      legacyHeaders: false
    })
  );

  app.use("/api/auth", authRouter);
  app.use("/api/integrations", integrationsRouter);
  app.use("/api/channels", requireAuth, customersRouter);
  app.use("/api/customers", requireAuth, customersRouter);
  app.use("/api/posts", requireAuth, postsRouter);
  app.use("/api/content", requireAuth, contentRouter);
  app.use("/api/cron", cronRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp();
