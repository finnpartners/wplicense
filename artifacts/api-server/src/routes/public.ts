import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { licensesTable, productsTable, settingsTable } from "@workspace/db/schema";
import { eq, and, isNotNull, ne } from "drizzle-orm";
import { normaliseDomain } from "../lib/domain";
import { checkRateLimit } from "../lib/rate-limit";
import { decrypt } from "../lib/encryption";

const router: IRouter = Router();

router.get("/finn/v1/status", (_req, res) => {
  res.json({ status: "ok", version: "1.0.0" });
});

router.post("/finn/v1/validate", async (req, res) => {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
    || req.headers["x-real-ip"] as string
    || req.socket.remoteAddress
    || "0.0.0.0";

  if (!checkRateLimit(ip)) {
    res.status(429).json({ data: { valid: false } });
    return;
  }

  try {
    const { key, fingerprint } = req.body;
    if (!key || !fingerprint) {
      res.json({ data: { valid: false } });
      return;
    }

    const [license] = await db.select().from(licensesTable).where(eq(licensesTable.licenseKey, key));
    if (!license || license.status !== "active") {
      res.json({ data: { valid: false } });
      return;
    }

    const normalizedFingerprint = normaliseDomain(fingerprint);
    const normalizedDomain = normaliseDomain(license.domain);

    res.json({ data: { valid: normalizedFingerprint === normalizedDomain } });
  } catch (err) {
    console.error("Validate error:", err);
    res.json({ data: { valid: false } });
  }
});

router.get("/finn/v1/products", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const providedKey = match[1];
    const [apiKeySetting] = await db.select().from(settingsTable).where(eq(settingsTable.key, "api_key"));
    if (!apiKeySetting) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    let storedKey: string;
    try {
      storedKey = decrypt(apiKeySetting.value);
    } catch {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    if (providedKey !== storedKey) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const products = await db.select().from(productsTable)
      .where(and(isNotNull(productsTable.downloadUrl), ne(productsTable.downloadUrl, "")))
      .orderBy(productsTable.name);

    res.json(products.map((p) => ({
      id: String(p.id),
      name: p.name,
      slug: p.slug,
      version: p.latestVersion,
      description: p.description,
    })));
  } catch (err) {
    console.error("Public products error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/finn/v1/update-check", async (req, res) => {
  const noUpdate = { version: null };

  try {
    const productId = req.query.product_id as string;
    const licenseKey = req.query.license as string;
    const fingerprint = req.query.fingerprint as string;

    if (!productId || !licenseKey || !fingerprint) {
      res.json(noUpdate);
      return;
    }

    const [license] = await db.select().from(licensesTable).where(eq(licensesTable.licenseKey, licenseKey));
    if (!license || license.status !== "active") {
      res.json(noUpdate);
      return;
    }

    const normalizedFingerprint = normaliseDomain(fingerprint);
    const normalizedDomain = normaliseDomain(license.domain);
    if (normalizedFingerprint !== normalizedDomain) {
      res.json(noUpdate);
      return;
    }

    if (license.pluginAccess !== "all") {
      if (!license.productIds) {
        res.json(noUpdate);
        return;
      }
      const ids = license.productIds.split(",").map((s) => s.trim());
      if (!ids.includes(productId)) {
        res.json(noUpdate);
        return;
      }
    }

    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, parseInt(productId, 10)));
    if (!product || !product.downloadUrl) {
      res.json(noUpdate);
      return;
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const downloadUrl = `${baseUrl}/api/finn/v1/download?product_id=${productId}&license=${licenseKey}&fingerprint=${fingerprint}`;

    res.json({
      version: product.latestVersion,
      downloadUrl,
      slug: product.slug,
      tested: product.testedWp,
      requires: product.requiresWp,
      requiresPhp: product.requiresPhp,
      sections: {
        changelog: product.changelog || "",
      },
    });
  } catch (err) {
    console.error("Update check error:", err);
    res.json(noUpdate);
  }
});

router.get("/finn/v1/download", async (req, res) => {
  try {
    const productId = req.query.product_id as string;
    const licenseKey = req.query.license as string;
    const fingerprint = req.query.fingerprint as string;

    if (!productId || !licenseKey || !fingerprint) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const [license] = await db.select().from(licensesTable).where(eq(licensesTable.licenseKey, licenseKey));
    if (!license || license.status !== "active") {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const normalizedFingerprint = normaliseDomain(fingerprint);
    const normalizedDomain = normaliseDomain(license.domain);
    if (normalizedFingerprint !== normalizedDomain) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    if (license.pluginAccess !== "all") {
      if (!license.productIds) {
        res.status(403).json({ message: "Forbidden" });
        return;
      }
      const ids = license.productIds.split(",").map((s) => s.trim());
      if (!ids.includes(productId)) {
        res.status(403).json({ message: "Forbidden" });
        return;
      }
    }

    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, parseInt(productId, 10)));
    if (!product || !product.downloadUrl) {
      res.status(404).json({ message: "Not Found" });
      return;
    }

    let githubToken = "";
    const [tokenSetting] = await db.select().from(settingsTable).where(eq(settingsTable.key, "github_token"));
    if (tokenSetting) {
      try {
        githubToken = decrypt(tokenSetting.value);
      } catch {
        githubToken = "";
      }
    }

    const headers: Record<string, string> = {
      Accept: "application/octet-stream",
      "User-Agent": "FINN-Licensing-Server/1.0.0",
    };
    if (githubToken) {
      headers["Authorization"] = `Bearer ${githubToken}`;
    }

    const response = await fetch(product.downloadUrl, {
      headers,
      redirect: "follow",
    });

    if (!response.ok || !response.body) {
      res.status(502).json({ message: "Download failed" });
      return;
    }

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="plugin.zip"');

    const reader = response.body.getReader();
    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    };
    await pump();
  } catch (err) {
    console.error("Download error:", err);
    res.status(502).json({ message: "Download failed" });
  }
});

export default router;
