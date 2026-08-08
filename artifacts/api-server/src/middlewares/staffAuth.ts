import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

// Named staff token registry — each entry maps a STAFF_SECRET_* env var to a
// human-readable identity attached to req.staffUser for audit purposes.
// Add new staff members by adding a new STAFF_SECRET_<NAME> env var and
// registering it here.
function buildTokenRegistry(): Record<string, { id: string; name: string }> {
  const registry: Record<string, { id: string; name: string }> = {};

  // Primary admin token
  if (process.env.STAFF_SECRET) {
    registry[process.env.STAFF_SECRET] = { id: "primary", name: "Admin" };
  }

  // Chris Coleman
  if (process.env.STAFF_SECRET_CHRIS) {
    registry[process.env.STAFF_SECRET_CHRIS] = { id: "chris", name: "Chris Coleman" };
  }

  return registry;
}

export function requireStaffAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const provided = req.cookies?.pinnacle_staff_token as string | undefined;

  if (!provided) {
    res.status(403).json({ error: "Invalid staff token" });
    return;
  }

  const registry = buildTokenRegistry();

  if (Object.keys(registry).length === 0) {
    res.status(503).json({ error: "Staff authentication is not configured" });
    return;
  }

  const match = registry[provided];
  if (!match) {
    res.status(403).json({ error: "Invalid staff token" });
    return;
  }

  (req as Request & { staffUser: { id: string; role: string; name: string } }).staffUser = {
    id: match.id,
    role: "admin",
    name: match.name,
  };
  next();
}