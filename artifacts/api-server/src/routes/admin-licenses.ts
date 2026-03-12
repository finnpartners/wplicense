import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { licensesTable, clientsTable } from "@workspace/db/schema";
import type { License } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { CreateLicenseBody, UpdateLicenseBody, GetLicenseParams, UpdateLicenseParams, DeleteLicenseParams, ToggleLicenseParams } from "@workspace/api-zod";
import { normaliseDomain } from "../lib/domain";

const router: IRouter = Router();

function formatLicense(license: Pick<License, "id" | "licenseKey" | "clientId" | "domain" | "pluginAccess" | "productIds" | "status" | "createdAt">, clientName?: string | null) {
  return {
    id: license.id,
    licenseKeyPreview: license.licenseKey.substring(0, 8) + "...",
    clientId: license.clientId,
    clientName: clientName ?? null,
    domain: license.domain,
    pluginAccess: license.pluginAccess,
    productIds: license.productIds ? license.productIds.split(",").map(Number) : null,
    status: license.status,
    createdAt: license.createdAt,
  };
}

router.get("/admin/licenses", async (_req, res) => {
  try {
    const licenses = await db
      .select({
        id: licensesTable.id,
        licenseKey: licensesTable.licenseKey,
        clientId: licensesTable.clientId,
        clientName: clientsTable.name,
        domain: licensesTable.domain,
        pluginAccess: licensesTable.pluginAccess,
        productIds: licensesTable.productIds,
        status: licensesTable.status,
        createdAt: licensesTable.createdAt,
      })
      .from(licensesTable)
      .leftJoin(clientsTable, eq(clientsTable.id, licensesTable.clientId))
      .orderBy(licensesTable.createdAt);

    res.json(licenses.map((l) => formatLicense(l, l.clientName)));
  } catch (err) {
    console.error("List licenses error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/admin/licenses", async (req, res) => {
  try {
    const parsed = CreateLicenseBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Client, domain, and plugin access are required" });
      return;
    }

    const domain = normaliseDomain(parsed.data.domain);
    const licenseKey = uuidv4();

    const productIds = parsed.data.pluginAccess === "specific" && parsed.data.productIds
      ? parsed.data.productIds.join(",")
      : null;

    const [license] = await db.insert(licensesTable).values({
      licenseKey,
      clientId: parsed.data.clientId,
      domain,
      pluginAccess: parsed.data.pluginAccess,
      productIds,
      status: parsed.data.status || "active",
    }).returning();

    const [client] = parsed.data.clientId
      ? await db.select({ name: clientsTable.name }).from(clientsTable).where(eq(clientsTable.id, parsed.data.clientId))
      : [null];

    res.status(201).json({
      license: formatLicense(license, client?.name ?? null),
      licenseKey,
    });
  } catch (err) {
    console.error("Create license error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/admin/licenses/:id", async (req, res) => {
  try {
    const params = GetLicenseParams.safeParse({ id: req.params.id });
    if (!params.success) {
      res.status(400).json({ message: "Invalid license ID" });
      return;
    }

    const rows = await db
      .select({
        id: licensesTable.id,
        licenseKey: licensesTable.licenseKey,
        clientId: licensesTable.clientId,
        clientName: clientsTable.name,
        domain: licensesTable.domain,
        pluginAccess: licensesTable.pluginAccess,
        productIds: licensesTable.productIds,
        status: licensesTable.status,
        createdAt: licensesTable.createdAt,
      })
      .from(licensesTable)
      .leftJoin(clientsTable, eq(clientsTable.id, licensesTable.clientId))
      .where(eq(licensesTable.id, params.data.id));

    if (rows.length === 0) {
      res.status(404).json({ message: "License not found" });
      return;
    }

    res.json(formatLicense(rows[0], rows[0].clientName));
  } catch (err) {
    console.error("Get license error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/admin/licenses/:id", async (req, res) => {
  try {
    const params = UpdateLicenseParams.safeParse({ id: req.params.id });
    if (!params.success) {
      res.status(400).json({ message: "Invalid license ID" });
      return;
    }

    const parsed = UpdateLicenseBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Client, domain, and plugin access are required" });
      return;
    }

    const domain = normaliseDomain(parsed.data.domain);
    const productIds = parsed.data.pluginAccess === "specific" && parsed.data.productIds
      ? parsed.data.productIds.join(",")
      : null;

    const [updated] = await db.update(licensesTable).set({
      clientId: parsed.data.clientId,
      domain,
      pluginAccess: parsed.data.pluginAccess,
      productIds,
      status: parsed.data.status || "active",
    }).where(eq(licensesTable.id, params.data.id)).returning();

    if (!updated) {
      res.status(404).json({ message: "License not found" });
      return;
    }

    const [client] = updated.clientId
      ? await db.select({ name: clientsTable.name }).from(clientsTable).where(eq(clientsTable.id, updated.clientId))
      : [null];

    res.json(formatLicense(updated, client?.name ?? null));
  } catch (err) {
    console.error("Update license error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/admin/licenses/:id", async (req, res) => {
  try {
    const params = DeleteLicenseParams.safeParse({ id: req.params.id });
    if (!params.success) {
      res.status(400).json({ message: "Invalid license ID" });
      return;
    }

    const [deleted] = await db.delete(licensesTable).where(eq(licensesTable.id, params.data.id)).returning();
    if (!deleted) {
      res.status(404).json({ message: "License not found" });
      return;
    }

    res.json({ message: "License deleted" });
  } catch (err) {
    console.error("Delete license error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/admin/licenses/:id/toggle", async (req, res) => {
  try {
    const params = ToggleLicenseParams.safeParse({ id: req.params.id });
    if (!params.success) {
      res.status(400).json({ message: "Invalid license ID" });
      return;
    }

    const [license] = await db.select().from(licensesTable).where(eq(licensesTable.id, params.data.id));
    if (!license) {
      res.status(404).json({ message: "License not found" });
      return;
    }

    const newStatus = license.status === "active" ? "revoked" : "active";
    const [updated] = await db.update(licensesTable).set({ status: newStatus }).where(eq(licensesTable.id, params.data.id)).returning();

    const [client] = updated.clientId
      ? await db.select({ name: clientsTable.name }).from(clientsTable).where(eq(clientsTable.id, updated.clientId))
      : [null];

    res.json(formatLicense(updated, client?.name ?? null));
  } catch (err) {
    console.error("Toggle license error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
