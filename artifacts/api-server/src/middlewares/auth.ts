import type { Request, Response, NextFunction } from "express";
import "../types/session";
import { getEasyAuthUser } from "../lib/easy-auth";

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
