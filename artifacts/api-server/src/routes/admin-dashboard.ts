import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { clientsTable, productsTable, licensesTable } from "@workspace/db/schema";
import { sql, eq } from "drizzle-orm";

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

router.get("/admin/api-key", async (_req, res) => {
  const apiKey = process.env.FINN_API_KEY || "";
  res.json({ apiKey });
});

export default router;
