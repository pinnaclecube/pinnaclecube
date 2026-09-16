import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import type { SafeProfile } from "@workspace/db/schema";
import { db, staffSessionsTable } from "@workspace/db";
import { eq, lt } from "drizzle-orm";

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

function getStaffTokenTTL(): number {
  const ttl = process.env.STAFF_TOKEN_TTL;
  if (!ttl) return 15 * 60 * 1000; // 15 minutes default
  return parseInt(ttl, 10) * 1000;
}

export async function generateStaffSessionToken(
  staffId: string,
  staffName: string,
): Promise<string> {
  const sessionToken = crypto.randomBytes(32).toString("hex");
  const ttl = getStaffTokenTTL();
  const expiresAt = new Date(Date.now() + ttl);

  await db.insert(staffSessionsTable).values({
    sessionToken,
    staffId,
    staffName,
    staffRole: "admin",
    expiresAt,
  });

  return sessionToken;
}

export async function rotateStaffToken(
  oldToken: string,
): Promise<string | null> {
  const [session] = await db
    .select()
    .from(staffSessionsTable)
    .where(eq(staffSessionsTable.sessionToken, oldToken))
    .limit(1);

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  const newToken = crypto.randomBytes(32).toString("hex");
  const ttl = getStaffTokenTTL();
  const expiresAt = new Date(Date.now() + ttl);

  await db.insert(staffSessionsTable).values({
    sessionToken: newToken,
    staffId: session.staffId,
    staffName: session.staffName,
    staffRole: session.staffRole,
    expiresAt,
  });

  await db
    .delete(staffSessionsTable)
    .where(eq(staffSessionsTable.sessionToken, oldToken));

  return newToken;
}

export async function validateStaffSession(
  sessionToken: string,
): Promise<{ id: string; name: string; role: string } | null> {
  const [session] = await db
    .select()
    .from(staffSessionsTable)
    .where(eq(staffSessionsTable.sessionToken, sessionToken))
    .limit(1);

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  return {
    id: session.staffId,
    name: session.staffName,
    role: session.staffRole,
  };
}

export async function cleanupExpiredStaffSessions(): Promise<void> {
  await db
    .delete(staffSessionsTable)
    .where(lt(staffSessionsTable.expiresAt, new Date()));
}
