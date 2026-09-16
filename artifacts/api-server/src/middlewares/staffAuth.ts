import type { Request, Response, NextFunction } from "express";
import { validateStaffSession } from "../services/auth";

export async function requireStaffAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const sessionToken = req.cookies?.staff_session;

  if (!sessionToken) {
    res.status(403).json({ error: "Staff authentication required" });
    return;
  }

  const staffUser = await validateStaffSession(sessionToken);

  if (!staffUser) {
    res.status(403).json({ error: "Invalid or expired staff session" });
    return;
  }

  (req as Request & { staffUser: { id: string; role: string; name: string } }).staffUser = staffUser;
  next();
}
