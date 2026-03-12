# FINN Licensing Server

## Overview

Full-stack web application for managing WordPress plugin licenses. Built with React + Express + PostgreSQL in a pnpm monorepo.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm (internal), npm (external/README)
- **TypeScript version**: 5.9
- **Frontend**: React 19 + Vite + Tailwind CSS + shadcn/ui + wouter (routing) + React Query
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: Azure Easy Auth (authentication handled at infrastructure level via headers)
- **Security**: Helmet, CSRF double-submit with timing-safe comparison, configurable CORS
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Features

- Admin dashboard with stats overview
- Client management (CRUD)
- Product management (CRUD + GitHub release polling)
- License management (CRUD + toggle active/revoked, auto-generated UUID keys)
- Settings (encrypted GitHub PAT, auto-generated API key with regeneration)
- Public API at `/api/*` for license validation, update checks, and download proxy
- Rate limiting on validation endpoint (60 req/hr per IP)
- Domain normalization (strips scheme, www, trailing slashes)
- Azure Easy Auth (infrastructure-level authentication); dev bypass login for local development

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (auto-provided by Replit)
- `SESSION_SECRET` — Required. Session signing secret
- `ENCRYPTION_KEY` — Required. Used to encrypt/decrypt stored secrets (API key, GitHub PAT)
- `CORS_ORIGIN` — Required in production. Comma-separated allowed origins
- `APP_BASE_URL` — Optional. Base URL for post-login redirect
- `APP_PATH` — Optional. Frontend app path prefix

## Authentication Flow

Authentication is handled by Azure Easy Auth at the infrastructure level. The app reads user identity from Easy Auth headers (`X-MS-CLIENT-PRINCIPAL-ID`, `X-MS-CLIENT-PRINCIPAL-NAME`). In development, a dev-login bypass creates a local session.

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   │   └── src/
│   │       ├── routes/     # auth, admin-*, public routes
│   │       ├── middlewares/ # auth, csrf middlewares
│   │       └── lib/        # domain, encryption, rate-limit, github-poller
│   └── licensing-app/      # React frontend (Vite)
│       └── src/
│           ├── pages/      # login, dashboard, clients, products, product-detail, settings
│           ├── hooks/      # use-api-wrappers (mutation hooks with invalidation)
│           └── components/ # layout/AppLayout, ui/* (shadcn)
├── shared/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
│       └── src/schema/     # clients, products, releases, licenses, settings, users, sessions
├── scripts/                # Utility scripts
│   └── src/
│       ├── seed-admin.ts   # Create default admin user (legacy, not needed with SSO)
│       └── clear-settings.ts
├── wp-client/              # WordPress integration files
│   ├── class-finn-licensing-client.php  # Generic drop-in licensing client
│   └── fp-dev-dashboard.php             # FINN DEV Dashboard plugin
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

## Database Tables

- `finn_clients` — Client records (name, company, email, notes)
- `finn_products` — Products/plugins (name, slug, githubRepo, version info, download URL)
- `finn_releases` — Release history per product (version, tagName, changelog, download URLs, publishedAt)
- `finn_licenses` — License keys (UUID key, domain, client ref, plugin access, status)
- `finn_settings` — Key-value settings store (encrypted values)
- `finn_users` — Admin users (legacy table, kept for schema compatibility)
- `finn_sessions` — Session store (connect-pg-simple)

## API Routes

### Auth
- `GET /api/auth/me` — Get current user from Easy Auth headers or session (id, email, name)
- `POST /api/auth/dev-login` — Dev-only session bypass (403 in production)
- `POST /api/auth/logout` — Destroy session

### Admin (require auth + CSRF)
- `GET /api/admin/dashboard` — Stats
- CRUD: `/api/admin/clients`, `/api/admin/products`, `/api/admin/licenses`
- `GET /api/admin/products/:id/releases` — List all releases for a product
- `POST /api/admin/products/:id/poll` — Poll GitHub for all releases and sync
- `POST /api/admin/licenses/:id/toggle` — Toggle license active/revoked
- `GET/PUT /api/admin/settings` — Settings management
- `POST /api/admin/settings/regenerate-api-key` — Regenerate global API key

### Public
- `GET /api/status` — Health check
- `POST /api/validate` — Validate license (rate-limited)
- `GET /api/products` — List products (Bearer token auth)
- `GET /api/update-check` — Check for plugin updates
- `GET /api/download` — Download plugin ZIP (proxied through GitHub)

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — only `.d.ts` files during typecheck; JS bundling via esbuild/tsx/vite

## Root Scripts

- `pnpm run build` — typecheck + build all packages
- `pnpm run typecheck` — tsc --build
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks/schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push schema to database

## Packages

### `artifacts/api-server` (`@workspace/api-server`)
Express 5 API server with admin CRUD routes and public licensing API. Uses Helmet for security headers. Auth via Azure Easy Auth headers.

### `artifacts/licensing-app` (`@workspace/licensing-app`)
React + Vite frontend with dark navy sidebar, admin pages for clients/products/licenses/settings.

### `shared/db` (`@workspace/db`)
Drizzle ORM schema and PostgreSQL connection. Exports pool, db instance, and all table schemas.

### `shared/api-spec` (`@workspace/api-spec`)
OpenAPI 3.1 spec and Orval codegen config.

### `shared/api-zod` (`@workspace/api-zod`)
Generated Zod schemas from OpenAPI spec.

### `shared/api-client-react` (`@workspace/api-client-react`)
Generated React Query hooks and fetch client.

### `scripts` (`@workspace/scripts`)
Utility scripts. Run via `pnpm --filter @workspace/scripts run <script>`.
