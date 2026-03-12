import express, { type Express } from "express";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import cookieParser from "cookie-parser";
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

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  session({
    store: new PgSession({
      pool: pool as any,
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

export default app;
