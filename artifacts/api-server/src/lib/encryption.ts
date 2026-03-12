import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("Missing required environment variable: ENCRYPTION_KEY");
  }
  return Buffer.from(crypto.createHash("sha256").update(secret).digest().subarray(0, 32));
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(text, "utf8", "base64");
  encrypted += cipher.final("base64");
  return iv.toString("base64") + ":" + encrypted;
}

export function decrypt(encrypted: string): string {
  const parts = encrypted.split(":");
  if (parts.length < 2) return "";
  const iv = Buffer.from(parts[0], "base64");
  const data = parts.slice(1).join(":");
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  let decrypted = decipher.update(data, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
