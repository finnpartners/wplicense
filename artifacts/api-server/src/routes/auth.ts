import { Router, type IRouter } from "express";
import "../types/session";
import { getEasyAuthUser } from "../lib/easy-auth";

const router: IRouter = Router();

router.get("/auth/me", (req, res) => {
  const easyAuthUser = getEasyAuthUser(req);
  if (easyAuthUser) {
    res.json(easyAuthUser);
    return;
  }

  if (req.session.userId) {
    res.json({
      id: req.session.userId,
      email: req.session.userEmail,
      name: req.session.userName,
    });
    return;
  }

  res.status(401).json({ message: "Not authenticated" });
});

router.post("/auth/dev-login", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    res.status(403).json({ message: "Dev login is not available in production." });
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

export default router;
