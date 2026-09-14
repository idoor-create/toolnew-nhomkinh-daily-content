import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { AppError } from "./error.js";

export type AuthUser = {
  id: number;
  email: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

type JwtPayload = {
  sub: string;
  email: string;
};

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.header("authorization");

  if (!header?.startsWith("Bearer ")) {
    return next(new AppError(401, "UNAUTHORIZED", "Bearer token is required."));
  }

  const token = header.slice("Bearer ".length).trim();

  try {
    const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
    const userId = Number(payload.sub);

    if (!Number.isInteger(userId) || !payload.email) {
      throw new Error("Invalid token payload.");
    }

    req.user = {
      id: userId,
      email: payload.email
    };

    return next();
  } catch {
    return next(new AppError(401, "UNAUTHORIZED", "Invalid or expired token."));
  }
}
