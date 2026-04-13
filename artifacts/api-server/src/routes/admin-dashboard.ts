import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { clientsTable, productsTable, licensesTable, userRolesTable } from "@workspace/db/schema";
import { sql, eq } from "drizzle-orm";
import { getGithubHeaders } from "../lib/github-poller";
import { getEasyAuthUser } from "../lib/easy-auth";
import { requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/admin/dashboard", async (_req, res) => {
  try {
    const [clientResult] = await db.select({ count: sql<number>`cast(count(*) as integer)` }).from(clientsTable);
    const [productResult] = await db.select({ count: sql<number>`cast(count(*) as integer)` }).from(productsTable);
    const [licenseResult] = await db.select({ count: sql<number>`cast(count(*) as integer)` }).from(licensesTable);
    const [activeResult] = await db.select({ count: sql<number>`cast(count(*) as integer)` }).from(licensesTable).where(eq(licensesTable.status, "active"));

    res.json({
      clientCount: clientResult.count,
      productCount: productResult.count,
      licenseCount: licenseResult.count,
      activeLicenseCount: activeResult.count,
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/admin/api-key", requireAdmin, async (_req, res) => {
  const apiKey = process.env.FINN_API_KEY || "";
  res.json({ apiKey });
});

router.get("/admin/my-role", async (req, res) => {
  const easyAuthUser = getEasyAuthUser(req);
  const email = easyAuthUser?.email?.toLowerCase() || req.session.userEmail?.toLowerCase();
  if (!email) {
    res.json({ role: "viewer" });
    return;
  }

  try {
    const [adminCount] = await db.select({ count: sql<number>`cast(count(*) as integer)` })
      .from(userRolesTable)
      .where(eq(userRolesTable.role, "admin"));

    if (adminCount.count === 0) {
      res.json({ role: "admin" });
      return;
    }

    const [row] = await db.select({ role: userRolesTable.role })
      .from(userRolesTable)
      .where(eq(userRolesTable.email, email));
    res.json({ role: row?.role || "viewer" });
  } catch {
    res.json({ role: "viewer" });
  }
});

router.get("/admin/user-roles", requireAdmin, async (_req, res) => {
  try {
    const roles = await db.select().from(userRolesTable).orderBy(userRolesTable.email);
    res.json(roles);
  } catch (err) {
    console.error("List user roles error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/admin/user-roles", requireAdmin, async (req, res) => {
  try {
    const { email, role } = req.body;
    if (!email || !role || !["admin", "viewer"].includes(role)) {
      res.status(400).json({ message: "Valid email and role (admin/viewer) are required" });
      return;
    }

    const emailLower = email.toLowerCase().trim();
    const [existing] = await db.select().from(userRolesTable).where(eq(userRolesTable.email, emailLower));
    if (existing) {
      if (existing.role === "admin" && role === "viewer") {
        const [adminCount] = await db.select({ count: sql<number>`cast(count(*) as integer)` })
          .from(userRolesTable)
          .where(eq(userRolesTable.role, "admin"));
        if (adminCount.count <= 1) {
          res.status(400).json({ message: "Cannot demote the last admin. Assign another admin first." });
          return;
        }
      }
      const [updated] = await db.update(userRolesTable)
        .set({ role })
        .where(eq(userRolesTable.email, emailLower))
        .returning();
      res.json(updated);
    } else {
      const [created] = await db.insert(userRolesTable)
        .values({ email: emailLower, role })
        .returning();
      res.status(201).json(created);
    }
  } catch (err) {
    console.error("Add user role error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/admin/user-roles/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      res.status(400).json({ message: "Invalid ID" });
      return;
    }

    const [target] = await db.select().from(userRolesTable).where(eq(userRolesTable.id, id));
    if (!target) {
      res.status(404).json({ message: "User role not found" });
      return;
    }

    if (target.role === "admin") {
      const [adminCount] = await db.select({ count: sql<number>`cast(count(*) as integer)` })
        .from(userRolesTable)
        .where(eq(userRolesTable.role, "admin"));
      if (adminCount.count <= 1) {
        res.status(400).json({ message: "Cannot remove the last admin. Assign another admin first." });
        return;
      }
    }

    await db.delete(userRolesTable).where(eq(userRolesTable.id, id));
    res.json({ message: "User role removed" });
  } catch (err) {
    console.error("Delete user role error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/admin/github-status", requireAdmin, async (_req, res) => {
  const headers = getGithubHeaders();
  if (!headers["Authorization"]) {
    res.json({ connected: false, message: "No GitHub token configured" });
    return;
  }

  try {
    const response = await fetch("https://api.github.com/user", {
      headers,
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      const user = await response.json() as { login: string; name: string | null };
      const rateRemaining = response.headers.get("x-ratelimit-remaining");
      const rateLimit = response.headers.get("x-ratelimit-limit");
      res.json({
        connected: true,
        login: user.login,
        name: user.name,
        rateLimit: rateLimit ? parseInt(rateLimit, 10) : null,
        rateRemaining: rateRemaining ? parseInt(rateRemaining, 10) : null,
      });
    } else if (response.status === 401) {
      res.json({ connected: false, message: "Token is invalid or expired" });
    } else {
      res.json({ connected: false, message: `GitHub returned status ${response.status}` });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.json({ connected: false, message });
  }
});

export default router;
