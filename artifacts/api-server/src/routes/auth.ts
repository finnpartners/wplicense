import { Router, type IRouter } from "express";
import crypto from "crypto";
import { getAuthorizeUrl, exchangeCodeForTokens, verifyIdToken, isAzureConfigured } from "../lib/azure-auth";
import "../types/session";

const router: IRouter = Router();

function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

function isUserAuthorized(email: string, oid: string): boolean {
  const allowedEmails = process.env.AZURE_ALLOWED_EMAILS;
  const allowedDomain = process.env.AZURE_ALLOWED_DOMAIN;

  if (allowedEmails) {
    const emails = allowedEmails.split(",").map(e => e.trim().toLowerCase());
    if (emails.includes(email.toLowerCase())) return true;
  }

  if (allowedDomain) {
    const domains = allowedDomain.split(",").map(d => d.trim().toLowerCase());
    const emailDomain = email.split("@")[1]?.toLowerCase();
    if (emailDomain && domains.includes(emailDomain)) return true;
  }

  if (!allowedEmails && !allowedDomain) {
    return true;
  }

  return false;
}

router.get("/auth/sso-status", (_req, res) => {
  const ssoEnabled = isAzureConfigured();
  const devLoginEnabled = !ssoEnabled && process.env.NODE_ENV !== "production";
  res.json({ ssoEnabled, devLoginEnabled });
});

router.get("/auth/login", (req, res) => {
  if (!isAzureConfigured()) {
    res.status(503).json({ message: "SSO is not available in this environment." });
    return;
  }

  try {
    const state = crypto.randomBytes(32).toString("hex");
    req.session.oauthState = state;

    const frontendRedirect = (req.query.redirect as string) || "/dashboard";
    req.session.postLoginRedirect = frontendRedirect;

    const authorizeUrl = getAuthorizeUrl(state);
    res.redirect(authorizeUrl);
  } catch (err) {
    console.error("Login redirect error:", err);
    res.status(500).json({ message: "Azure AD configuration error." });
  }
});

router.get("/auth/callback", async (req, res) => {
  if (!isAzureConfigured()) {
    res.status(503).send("SSO is not available in this environment.");
    return;
  }

  try {
    const { code, state, error, error_description } = req.query;

    if (error) {
      console.error("Azure AD error:", error, error_description);
      res.status(401).send("Authentication failed. Please try again.");
      return;
    }

    if (!code || typeof code !== "string") {
      res.status(400).send("Missing authorization code.");
      return;
    }

    const savedState = req.session.oauthState;
    if (!state || typeof state !== "string" || !savedState || !timingSafeCompare(state, savedState)) {
      res.status(403).send("Invalid state parameter. Possible CSRF attack.");
      return;
    }

    delete req.session.oauthState;

    const { idToken } = await exchangeCodeForTokens(code);
    const user = await verifyIdToken(idToken);

    if (!isUserAuthorized(user.email, user.oid)) {
      console.warn(`Unauthorized login attempt: ${user.email} (${user.oid})`);
      res.status(403).send("Access denied. Your account is not authorized to use this application.");
      return;
    }

    const postLoginRedirect = req.session.postLoginRedirect || "/dashboard";

    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    req.session.userId = user.oid;
    req.session.userEmail = user.email;
    req.session.userName = user.name;

    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;
    const appPath = process.env.APP_PATH || "";
    res.redirect(`${baseUrl}${appPath}${postLoginRedirect}`);
  } catch (err) {
    console.error("Auth callback error:", err);
    res.status(500).send("Authentication failed. Please try again.");
  }
});

router.post("/auth/dev-login", async (req, res) => {
  if (process.env.NODE_ENV === "production" || isAzureConfigured()) {
    res.status(403).json({ message: "Dev login is not available in this environment." });
    return;
  }

  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  req.session.userId = "dev-user";
  req.session.userEmail = "dev@localhost";
  req.session.userName = "Developer";

  await new Promise<void>((resolve, reject) => {
    req.session.save((err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  res.json({ success: true });
});

router.get("/auth/me", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  res.json({
    id: req.session.userId,
    email: req.session.userEmail,
    name: req.session.userName,
  });
});

export default router;
