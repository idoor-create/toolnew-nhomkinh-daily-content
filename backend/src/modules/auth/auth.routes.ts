import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { getMe, login } from "./auth.service.js";

export const authRouter = Router();

authRouter.post("/login", async (req, res, next) => {
  try {
    res.json(await login(req.body));
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    res.json(await getMe(req.user!.id));
  } catch (error) {
    next(error);
  }
});
