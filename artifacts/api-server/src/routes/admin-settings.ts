import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { encrypt, decrypt } from "../lib/encryption";

const router: IRouter = Router();

async function getOrCreateApiKey(): Promise<string> {
  const [existing] = await db.select().from(settingsTable).where(eq(settingsTable.key, "api_key"));
  if (existing) {
    try {
      return decrypt(existing.value);
    } catch {
      return "";
    }
  }

  const newKey = uuidv4();
  await db.insert(settingsTable).values({ key: "api_key", value: encrypt(newKey) });
  return newKey;
}

router.get("/admin/settings", async (_req, res) => {
  try {
    const apiKey = await getOrCreateApiKey();

    const [tokenSetting] = await db.select().from(settingsTable).where(eq(settingsTable.key, "github_token"));
    const hasGithubToken = !!tokenSetting;

    res.json({ apiKey, hasGithubToken });
  } catch (err) {
    console.error("Get settings error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/admin/settings", async (req, res) => {
  try {
    const { githubToken } = req.body;

    if (githubToken && typeof githubToken === "string" && githubToken.trim()) {
      const encrypted = encrypt(githubToken.trim());
      const [existing] = await db.select().from(settingsTable).where(eq(settingsTable.key, "github_token"));
      if (existing) {
        await db.update(settingsTable).set({ value: encrypted }).where(eq(settingsTable.key, "github_token"));
      } else {
        await db.insert(settingsTable).values({ key: "github_token", value: encrypted });
      }
    }

    const apiKey = await getOrCreateApiKey();
    const [tokenSetting] = await db.select().from(settingsTable).where(eq(settingsTable.key, "github_token"));

    res.json({ apiKey, hasGithubToken: !!tokenSetting });
  } catch (err) {
    console.error("Update settings error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/admin/settings/regenerate-api-key", async (_req, res) => {
  try {
    const newKey = uuidv4();
    const encrypted = encrypt(newKey);

    const [existing] = await db.select().from(settingsTable).where(eq(settingsTable.key, "api_key"));
    if (existing) {
      await db.update(settingsTable).set({ value: encrypted }).where(eq(settingsTable.key, "api_key"));
    } else {
      await db.insert(settingsTable).values({ key: "api_key", value: encrypted });
    }

    const [tokenSetting] = await db.select().from(settingsTable).where(eq(settingsTable.key, "github_token"));

    res.json({ apiKey: newKey, hasGithubToken: !!tokenSetting });
  } catch (err) {
    console.error("Regenerate API key error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
