import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { licensesTable, clientsTable, domainPluginsTable, productsTable } from "@workspace/db/schema";
import type { License } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { CreateLicenseBody, UpdateLicenseBody, GetLicenseParams, UpdateLicenseParams, DeleteLicenseParams, ToggleLicenseParams } from "@workspace/api-zod";
import { normaliseDomain } from "../lib/domain";

const router: IRouter = Router();

function formatLicense(license: Pick<License, "id" | "licenseKey" | "clientId" | "domain" | "pluginAccess" | "productIds" | "status" | "createdAt">, clientName?: string | null) {
  return {
    id: license.id,
    licenseKey: license.licenseKey,
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

router.post("/admin/ping-site", async (req, res) => {
  try {
    const { domain } = req.body;
    if (!domain) {
      res.status(400).json({ message: "Domain is required" });
      return;
    }

    const normalizedDomain = normaliseDomain(domain);

    const licenses = await db
      .select({ id: licensesTable.id, licenseKey: licensesTable.licenseKey, domain: licensesTable.domain })
      .from(licensesTable)
      .where(eq(licensesTable.status, "active"));

    const license = licenses.find(l => normaliseDomain(l.domain) === normalizedDomain);
    if (!license) {
      res.status(404).json({ message: "No active license found for this domain" });
      return;
    }

    const protocols = ["https", "http"];
    let siteData: { plugins: { slug: string; version: string; active: boolean }[] } | null = null;

    for (const proto of protocols) {
      try {
        const url = `${proto}://${normalizedDomain}/wp-json/fp-dev/v1/status`;
        const response = await fetch(url, {
          headers: { "X-License-Key": license.licenseKey, "Accept": "application/json" },
          signal: AbortSignal.timeout(10000),
        });
        if (response.ok) {
          siteData = await response.json() as typeof siteData;
          break;
        }
      } catch {
      }
    }

    if (!siteData || !Array.isArray(siteData.plugins)) {
      res.status(502).json({ message: "Could not reach the site. Ensure the FP Dev Dashboard plugin (v2.0.3+) is active." });
      return;
    }

    const allProducts = await db.select({ id: productsTable.id, slug: productsTable.slug }).from(productsTable);
    const slugToProduct = new Map(allProducts.map(p => [p.slug, p]));

    let updated = 0;
    for (const plugin of siteData.plugins) {
      const product = slugToProduct.get(plugin.slug);
      if (!product) continue;

      await db.insert(domainPluginsTable)
        .values({
          licenseId: license.id,
          productId: product.id,
          domain: normalizedDomain,
          currentVersion: plugin.version,
          lastCheckedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [domainPluginsTable.licenseId, domainPluginsTable.productId],
          set: {
            domain: normalizedDomain,
            currentVersion: plugin.version,
            lastCheckedAt: new Date(),
          },
        });
      updated++;
    }

    res.json({ message: `Pinged ${normalizedDomain} successfully`, pluginsFound: siteData.plugins.length, updated });
  } catch (err) {
    console.error("Ping site error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/admin/domain-plugins", async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: domainPluginsTable.id,
        licenseId: domainPluginsTable.licenseId,
        productId: domainPluginsTable.productId,
        domain: domainPluginsTable.domain,
        currentVersion: domainPluginsTable.currentVersion,
        lastCheckedAt: domainPluginsTable.lastCheckedAt,
        productName: productsTable.name,
        productSlug: productsTable.slug,
        latestVersion: productsTable.latestVersion,
      })
      .from(domainPluginsTable)
      .leftJoin(productsTable, eq(productsTable.id, domainPluginsTable.productId))
      .orderBy(domainPluginsTable.domain, productsTable.name);

    res.json(rows);
  } catch (err) {
    console.error("List domain plugins error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
