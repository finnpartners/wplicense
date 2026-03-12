import { db } from "@workspace/db";
import { productsTable, settingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "./encryption";

export async function pollProduct(productId: number): Promise<{ success: boolean; message: string }> {
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!product) {
    return { success: false, message: "Product not found" };
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

  const repo = product.githubRepo;
  const url = `https://api.github.com/repos/${repo}/releases/latest`;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "FINN-Licensing-Server/1.0.0",
  };

  if (githubToken) {
    headers["Authorization"] = `Bearer ${githubToken}`;
  }

  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });

    if (!response.ok) {
      await db.update(productsTable).set({ lastChecked: new Date() }).where(eq(productsTable.id, productId));
      return { success: false, message: `GitHub API returned ${response.status}` };
    }

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
    }

    const body: GitHubRelease = await response.json() as GitHubRelease;

    let downloadUrl = "";
    for (const asset of body.assets || []) {
      if (asset.name && asset.name.toLowerCase().endsWith(".zip")) {
        downloadUrl = asset.browser_download_url || "";
        break;
      }
    }

    if (!downloadUrl && body.zipball_url) {
      downloadUrl = body.zipball_url;
    }

    if (!downloadUrl) {
      await db.update(productsTable).set({ lastChecked: new Date() }).where(eq(productsTable.id, productId));
      return { success: false, message: "No downloadable asset found in latest release" };
    }

    const version = (body.tag_name || "").replace(/^v/, "");
    const releaseDate = body.published_at ? new Date(body.published_at) : null;
    const changelog = body.body || "";

    await db.update(productsTable).set({
      latestVersion: version,
      releaseDate,
      changelog,
      downloadUrl,
      lastChecked: new Date(),
    }).where(eq(productsTable.id, productId));

    return { success: true, message: `Updated to version ${version}` };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, message };
  }
}
