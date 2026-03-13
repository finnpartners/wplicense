import { db } from "@workspace/db";
import { productsTable, releasesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

interface GitHubAsset {
  name: string;
  browser_download_url: string;
}
interface GitHubRelease {
  tag_name: string;
  published_at: string;
  body: string;
  assets: GitHubAsset[];
  zipball_url?: string;
  draft?: boolean;
  prerelease?: boolean;
}

export function getGithubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "FINN-Licensing-Server/1.0.0",
  };

  const token = process.env.GITHUB_PAT;
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
}

function extractDownloadUrl(release: GitHubRelease): { downloadUrl: string; zipballUrl: string } {
  let downloadUrl = "";
  for (const asset of release.assets || []) {
    if (asset.name && asset.name.toLowerCase().endsWith(".zip")) {
      downloadUrl = asset.browser_download_url || "";
      break;
    }
  }

  const zipballUrl = release.zipball_url || "";
  if (!downloadUrl && zipballUrl) {
    downloadUrl = zipballUrl;
  }

  return { downloadUrl, zipballUrl };
}

function parseNextPageUrl(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
  return match ? match[1] : null;
}

async function fetchAllReleases(repo: string, headers: Record<string, string>): Promise<GitHubRelease[]> {
  const allReleases: GitHubRelease[] = [];
  let url: string | null = `https://api.github.com/repos/${repo}/releases?per_page=100`;

  while (url) {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status}`);
    }

    const page: GitHubRelease[] = await response.json() as GitHubRelease[];
    allReleases.push(...page);

    url = parseNextPageUrl(response.headers.get("link"));
  }

  return allReleases;
}

async function upsertRelease(productId: number, release: GitHubRelease): Promise<void> {
  const { downloadUrl, zipballUrl } = extractDownloadUrl(release);
  const version = (release.tag_name || "").replace(/^v/, "");
  const publishedAt = release.published_at ? new Date(release.published_at) : null;
  const changelog = release.body || "";

  const existing = await db.select({ id: releasesTable.id })
    .from(releasesTable)
    .where(and(eq(releasesTable.productId, productId), eq(releasesTable.tagName, release.tag_name)));

  if (existing.length > 0) {
    await db.update(releasesTable).set({
      version,
      changelog,
      downloadUrl,
      zipballUrl,
      publishedAt,
    }).where(eq(releasesTable.id, existing[0].id));
  } else {
    await db.insert(releasesTable).values({
      productId,
      version,
      tagName: release.tag_name,
      changelog,
      downloadUrl,
      zipballUrl,
      publishedAt,
    });
  }
}

const POLL_INTERVAL_MS = 24 * 60 * 60 * 1000;
let pollTimer: ReturnType<typeof setInterval> | null = null;

export async function pollAllProducts(): Promise<void> {
  const products = await db.select({ id: productsTable.id, name: productsTable.name })
    .from(productsTable);

  if (products.length === 0) {
    console.log("[Poller] No products to poll");
    return;
  }

  console.log(`[Poller] Polling ${products.length} product(s) for new releases...`);

  for (const product of products) {
    try {
      const result = await pollProduct(product.id);
      if (result.success) {
        console.log(`[Poller] ${product.name}: ${result.message}`);
      }
    } catch (err) {
      console.error(`[Poller] Error polling ${product.name}:`, err);
    }
  }

  console.log("[Poller] Daily poll complete");
}

export function startDailyPoller(): void {
  if (pollTimer) return;

  setTimeout(() => {
    pollAllProducts().catch((err) => console.error("[Poller] Initial poll failed:", err));
  }, 30_000);

  pollTimer = setInterval(() => {
    pollAllProducts().catch((err) => console.error("[Poller] Scheduled poll failed:", err));
  }, POLL_INTERVAL_MS);

  console.log("[Poller] Daily release poller started (every 24h)");
}

export async function pollProduct(productId: number): Promise<{ success: boolean; message: string }> {
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!product) {
    return { success: false, message: "Product not found" };
  }

  const headers = getGithubHeaders();
  const repo = product.githubRepo;

  try {
    const releases = await fetchAllReleases(repo, headers);

    if (!releases || releases.length === 0) {
      await db.update(productsTable).set({ lastChecked: new Date() }).where(eq(productsTable.id, productId));
      return { success: false, message: "No releases found in repository" };
    }

    for (const release of releases) {
      await upsertRelease(productId, release);
    }

    const stableReleases = releases.filter(r => !r.draft && !r.prerelease);
    const latest = stableReleases.length > 0 ? stableReleases[0] : releases[0];
    const { downloadUrl } = extractDownloadUrl(latest);
    const version = (latest.tag_name || "").replace(/^v/, "");
    const releaseDate = latest.published_at ? new Date(latest.published_at) : null;
    const changelog = latest.body || "";

    await db.update(productsTable).set({
      latestVersion: version,
      releaseDate,
      changelog,
      downloadUrl,
      lastChecked: new Date(),
    }).where(eq(productsTable.id, productId));

    return { success: true, message: `Updated to version ${version} (${releases.length} releases synced)` };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, message };
  }
}
