import type { Request, Response, NextFunction } from "express";
import "../types/session";
import { getEasyAuthUser } from "../lib/easy-auth";
import { db } from "@workspace/db";
import { userRolesTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";

function getUserEmail(req: Request): string | null {
  const easyAuthUser = getEasyAuthUser(req);
  if (easyAuthUser) return easyAuthUser.email.toLowerCase();
  if (req.session.userEmail) return req.session.userEmail.toLowerCase();
  return null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (getEasyAuthUser(req)) {
    next();
    return;
  }

  if (req.session.userId) {
    next();
    return;
  }

  res.status(401).json({ message: "Not authenticated" });
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const email = getUserEmail(req);
  if (!email) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  try {
    const [adminCount] = await db.select({ count: sql<number>`cast(count(*) as integer)` })
      .from(userRolesTable)
      .where(eq(userRolesTable.role, "admin"));

    if (adminCount.count === 0) {
      next();
      return;
    }

    const [row] = await db.select({ role: userRolesTable.role })
      .from(userRolesTable)
      .where(eq(userRolesTable.email, email));

    if (row?.role === "admin") {
      next();
    } else {
      res.status(403).json({ message: "Admin access required" });
    }
  } catch (err) {
    console.error("Role check error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
}
