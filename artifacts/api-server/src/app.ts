import express, { type Express } from "express";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import path from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { pool } from "@workspace/db";
import router from "./routes";

const PgSession = connectPgSimple(session);

function getRequiredSecret(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(`Missing required environment variable: ${name}. Set it before starting the server.`);
  }
  return val;
}

const app: Express = express();

app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map(s => s.trim())
  : [];

app.use(cors({
  origin: process.env.NODE_ENV === "production"
    ? allowedOrigins
    : true,
  credentials: true,
}));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  session({
    store: new PgSession({
      pool: pool,
      tableName: "finn_sessions",
      createTableIfMissing: true,
    }),
    secret: getRequiredSecret("SESSION_SECRET"),
    resave: false,
    saveUninitialized: false,
    name: "finn.sid",
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  })
);

app.use("/api", router);

if (process.env.NODE_ENV === "production") {
  let dir: string;
  try {
    dir = path.dirname(fileURLToPath(import.meta.url));
  } catch {
    dir = __dirname;
  }
  const candidates = [
    path.resolve(dir, "public"),
    path.resolve(dir, "../../artifacts/licensing-app/dist/public"),
    path.resolve(process.cwd(), "public"),
  ];
  const staticDir = candidates.find((p) => existsSync(p));
  if (staticDir) {
    app.use(express.static(staticDir));
    app.get("/{*splat}", (_req, res) => {
      res.sendFile(path.join(staticDir, "index.html"));
    });
  }
}

export default app;
