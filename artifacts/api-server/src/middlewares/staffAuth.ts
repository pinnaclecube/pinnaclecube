import type { Request, Response, NextFunction } from "express";

export function requireStaffAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const staffSecret = process.env.STAFF_SECRET;
  const provided = req.headers["x-staff-token"];

  if (!staffSecret) {
    res.status(503).json({ error: "Staff authentication is not configured" });
    return;
  }

  if (!provided || provided !== staffSecret) {
    res.status(403).json({ error: "Invalid staff token" });
    return;
  }

  (req as Request & { staffUser: { id: string; role: string } }).staffUser = {
    id: "staff",
    role: "admin",
  };
  next();
}
