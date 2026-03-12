import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { productsTable, licensesTable, releasesTable } from "@workspace/db/schema";
import { eq, ne, and, sql, like, desc } from "drizzle-orm";
import { CreateProductBody, UpdateProductBody, GetProductParams, UpdateProductParams, DeleteProductParams, PollProductParams, ListProductReleasesParams } from "@workspace/api-zod";
import { pollProduct, getGithubHeaders } from "../lib/github-poller";

const router: IRouter = Router();

router.get("/admin/products", async (_req, res) => {
  try {
    const products = await db.select().from(productsTable).orderBy(productsTable.name);
    res.json(products);
  } catch (err) {
    console.error("List products error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/admin/products", async (req, res) => {
  try {
    const parsed = CreateProductBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Name, slug, and GitHub repo are required" });
      return;
    }

    if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(parsed.data.githubRepo)) {
      res.status(400).json({ message: "GitHub repo must be in owner/repo format" });
      return;
    }

    const existing = await db.select({ id: productsTable.id }).from(productsTable).where(eq(productsTable.slug, parsed.data.slug));
    if (existing.length > 0) {
      res.status(400).json({ message: "A product with this slug already exists" });
      return;
    }

    const [product] = await db.insert(productsTable).values({
      name: parsed.data.name,
      slug: parsed.data.slug,
      githubRepo: parsed.data.githubRepo,
      description: parsed.data.description ?? null,
      requiresWp: parsed.data.requiresWp ?? null,
      testedWp: parsed.data.testedWp ?? null,
      requiresPhp: parsed.data.requiresPhp ?? null,
    }).returning();

    res.status(201).json(product);
  } catch (err) {
    console.error("Create product error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/admin/products/:id", async (req, res) => {
  try {
    const params = GetProductParams.safeParse({ id: req.params.id });
    if (!params.success) {
      res.status(400).json({ message: "Invalid product ID" });
      return;
    }

    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, params.data.id));
    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }

    res.json(product);
  } catch (err) {
    console.error("Get product error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/admin/products/:id", async (req, res) => {
  try {
    const params = UpdateProductParams.safeParse({ id: req.params.id });
    if (!params.success) {
      res.status(400).json({ message: "Invalid product ID" });
      return;
    }

    const parsed = UpdateProductBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Name, slug, and GitHub repo are required" });
      return;
    }

    if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(parsed.data.githubRepo)) {
      res.status(400).json({ message: "GitHub repo must be in owner/repo format" });
      return;
    }

    const [slugConflict] = await db.select({ id: productsTable.id }).from(productsTable)
      .where(and(eq(productsTable.slug, parsed.data.slug), ne(productsTable.id, params.data.id)));
    if (slugConflict) {
      res.status(400).json({ message: "A product with this slug already exists" });
      return;
    }

    const [updated] = await db.update(productsTable).set({
      name: parsed.data.name,
      slug: parsed.data.slug,
      githubRepo: parsed.data.githubRepo,
      description: parsed.data.description ?? null,
      requiresWp: parsed.data.requiresWp ?? null,
      testedWp: parsed.data.testedWp ?? null,
      requiresPhp: parsed.data.requiresPhp ?? null,
    }).where(eq(productsTable.id, params.data.id)).returning();

    if (!updated) {
      res.status(404).json({ message: "Product not found" });
      return;
    }

    res.json(updated);
  } catch (err) {
    console.error("Update product error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/admin/products/:id", async (req, res) => {
  try {
    const params = DeleteProductParams.safeParse({ id: req.params.id });
    if (!params.success) {
      res.status(400).json({ message: "Invalid product ID" });
      return;
    }

    const productId = params.data.id;

    const specificLicenses = await db.select()
      .from(licensesTable)
      .where(eq(licensesTable.pluginAccess, "specific"));

    for (const license of specificLicenses) {
      if (!license.productIds) continue;
      const ids = license.productIds.split(",").map((s) => parseInt(s.trim(), 10)).filter(Boolean);
      const filtered = ids.filter((id) => id !== productId);
      if (filtered.length === 0) {
        await db.update(licensesTable).set({ pluginAccess: "all", productIds: null }).where(eq(licensesTable.id, license.id));
      } else if (filtered.length !== ids.length) {
        await db.update(licensesTable).set({ productIds: filtered.join(",") }).where(eq(licensesTable.id, license.id));
      }
    }

    const [deleted] = await db.delete(productsTable).where(eq(productsTable.id, productId)).returning();
    if (!deleted) {
      res.status(404).json({ message: "Product not found" });
      return;
    }

    res.json({ message: "Product deleted. Affected license assignments have been updated." });
  } catch (err) {
    console.error("Delete product error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/admin/products/:id/releases", async (req, res) => {
  try {
    const params = ListProductReleasesParams.safeParse({ id: req.params.id });
    if (!params.success) {
      res.status(400).json({ message: "Invalid product ID" });
      return;
    }

    const [product] = await db.select({ id: productsTable.id }).from(productsTable).where(eq(productsTable.id, params.data.id));
    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }

    const releases = await db.select().from(releasesTable)
      .where(eq(releasesTable.productId, params.data.id))
      .orderBy(desc(releasesTable.publishedAt));

    res.json(releases);
  } catch (err) {
    console.error("List releases error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/admin/products/:id/poll", async (req, res) => {
  try {
    const params = PollProductParams.safeParse({ id: req.params.id });
    if (!params.success) {
      res.status(400).json({ message: "Invalid product ID" });
      return;
    }

    const result = await pollProduct(params.data.id);

    if (result.success) {
      const [product] = await db.select().from(productsTable).where(eq(productsTable.id, params.data.id));
      res.json({ success: true, message: result.message, product });
    } else {
      res.json({ success: false, message: result.message });
    }
  } catch (err) {
    console.error("Poll product error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/admin/github/repos", async (req, res) => {
  try {
    const headers = await getGithubHeaders();
    if (!headers["Authorization"]) {
      res.status(400).json({ message: "GitHub token is not configured. Add it in Settings first." });
      return;
    }

    const query = (req.query.q as string) || "";
    const existingProducts = await db.select({ githubRepo: productsTable.githubRepo }).from(productsTable);
    const existingRepos = new Set(existingProducts.map(p => p.githubRepo.toLowerCase()));

    let repos: Array<{ full_name: string; name: string; description: string | null; private: boolean }>;

    const allRepos: Array<{ full_name: string; name: string; description: string | null; private: boolean }> = [];
    let page = 1;
    while (page <= 5) {
      const repoRes = await fetch(
        `https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,organization_member&page=${page}`,
        { headers, signal: AbortSignal.timeout(10000) }
      );
      if (!repoRes.ok) {
        res.status(502).json({ message: "Failed to fetch repositories from GitHub" });
        return;
      }
      const pageRepos = await repoRes.json() as Array<{ full_name: string; name: string; description: string | null; private: boolean }>;
      allRepos.push(...pageRepos);
      if (pageRepos.length < 100) break;
      page++;
    }

    if (query) {
      const q = query.toLowerCase();
      repos = allRepos.filter(r =>
        r.full_name.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q))
      );
    } else {
      repos = allRepos;
    }

    const result = repos.map(r => ({
      fullName: r.full_name,
      name: r.name,
      description: r.description,
      isPrivate: r.private,
      alreadyAdded: existingRepos.has(r.full_name.toLowerCase()),
    }));

    res.json(result);
  } catch (err) {
    console.error("GitHub repos error:", err);
    res.status(500).json({ message: "Failed to fetch GitHub repositories" });
  }
});

export default router;
