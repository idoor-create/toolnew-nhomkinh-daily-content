import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { z } from "zod";
import { config } from "../../config.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../middleware/error.js";

export const loginSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1)
});

function publicUser(user: { id: number; email: string; name: string }) {
  return {
    id: user.id,
    email: user.email,
    name: user.name
  };
}

function signUser(user: { id: number; email: string; name: string }) {
  const signOptions: SignOptions = {
    subject: String(user.id),
    expiresIn: config.jwtExpiresIn as SignOptions["expiresIn"]
  };

  const token = jwt.sign(
    { email: user.email },
    config.jwtSecret,
    signOptions
  );

  return {
    token,
    user: publicUser(user)
  };
}

function isDatabaseReachabilityError(error: unknown) {
  return error instanceof Error && /can't reach database server|P1001/i.test(error.message);
}

function canUseEnvAdmin(email: string, password: string) {
  return Boolean(config.admin.email && config.admin.password && email === config.admin.email && password === config.admin.password);
}

function envAdminUser() {
  return { id: 0, email: config.admin.email, name: config.admin.name };
}

export async function login(input: unknown) {
  const data = loginSchema.parse(input);
  let user: { id: number; email: string; name: string; passwordHash: string } | null = null;

  try {
    user = await prisma.user.findUnique({ where: { email: data.email } });
  } catch (error) {
    if (isDatabaseReachabilityError(error) && canUseEnvAdmin(data.email, data.password)) {
      return signUser(envAdminUser());
    }
    throw error;
  }

  if (!user) {
    if (canUseEnvAdmin(data.email, data.password)) {
      return signUser(envAdminUser());
    }
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
  }

  const passwordMatches = await bcrypt.compare(data.password, user.passwordHash);

  if (!passwordMatches) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
  }

  return signUser(user);
}

export async function getMe(userId: number) {
  if (userId === 0 && config.admin.email) {
    return { user: publicUser(envAdminUser()) };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true }
  });

  if (!user) {
    throw new AppError(401, "UNAUTHORIZED", "User not found.");
  }

  return { user };
}
