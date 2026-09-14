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

export async function login(input: unknown) {
  const data = loginSchema.parse(input);
  const user = await prisma.user.findUnique({ where: { email: data.email } });

  if (!user) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
  }

  const passwordMatches = await bcrypt.compare(data.password, user.passwordHash);

  if (!passwordMatches) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
  }

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

export async function getMe(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true }
  });

  if (!user) {
    throw new AppError(401, "UNAUTHORIZED", "User not found.");
  }

  return { user };
}
