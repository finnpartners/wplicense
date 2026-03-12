import path from "path";
import { fileURLToPath } from "url";
import { build as esbuild } from "esbuild";
import { rm, readFile, cp, writeFile } from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");

const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  const distDir = path.resolve(__dirname, "dist");
  await rm(distDir, { recursive: true, force: true });

  console.log("Building server bundle...");
  const pkgPath = path.resolve(__dirname, "package.json");
  const pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter(
    (dep) =>
      !allowlist.includes(dep) &&
      !(pkg.dependencies?.[dep]?.startsWith("workspace:")),
  );

  await esbuild({
    entryPoints: [path.resolve(__dirname, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: path.resolve(distDir, "index.cjs"),
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });

  console.log("Copying frontend build...");
  const frontendDist = path.resolve(rootDir, "artifacts/licensing-app/dist/public");
  await cp(frontendDist, path.resolve(distDir, "public"), { recursive: true });

  console.log("Copying database migrations...");
  const migrationsDir = path.resolve(rootDir, "shared/db/migrations");
  await cp(migrationsDir, path.resolve(distDir, "migrations"), { recursive: true });

  console.log("Writing production package.json...");
  const prodPkg = {
    name: "finn-licensing-server",
    version: "1.0.0",
    private: true,
    scripts: {
      start: "node index.cjs",
    },
    engines: {
      node: ">=20",
    },
  };
  await writeFile(path.resolve(distDir, "package.json"), JSON.stringify(prodPkg, null, 2));

  console.log("Build complete. Output: artifacts/api-server/dist/");
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
