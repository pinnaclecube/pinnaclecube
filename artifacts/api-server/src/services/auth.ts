import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { SafeProfile } from "@workspace/db/schema";

const SALT_ROUNDS = 12;
const JWT_EXPIRY = "7d";

function getJwtSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET env var is not set");
  return secret;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(profile: SafeProfile): string {
  const payload = {
    sub: profile.id,
    email: profile.email,
  };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRY });
}

export function verifyToken(token: string): { sub: number; email: string } {
  return jwt.verify(token, getJwtSecret()) as { sub: number; email: string };
}

export function stripPassword<T extends { passwordHash?: string | null }>(
  profile: T,
): Omit<T, "passwordHash"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash: _, ...safe } = profile;
  return safe;
}
