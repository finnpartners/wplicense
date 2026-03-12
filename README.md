# FINN Licensing

A standalone full-stack licensing server for managing clients, products, licenses, and delivering updates. Built with React, Express, and PostgreSQL. 

## What It Does

- **Client Management** — Track clients with contact details and notes
- **Product Management** — Register GitHub repositories as distributable products, automatically sync all releases
- **License Management** — Issue UUID license keys tied to specific domains and products, toggle active/revoked status
- **Update Delivery** — WordPress plugins check for updates and download new versions through the public API, gated by license validation
- **GitHub Integration** — Polls GitHub releases (with pagination), stores full release history, proxies downloads with token auth
- **Azure Easy Auth** — Admin authentication handled at the infrastructure level

## Quick Start

### Prerequisites

- Node.js 24+
- npm 10+
- PostgreSQL database

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | Session signing secret (any random string, 32+ characters) |
| `ENCRYPTION_KEY` | Yes | Used to encrypt stored secrets like the GitHub PAT and API key |
| `CORS_ORIGIN` | Yes (prod) | Comma-separated list of allowed origins (required in production) |
| `APP_BASE_URL` | No | Base URL for post-login redirect (auto-detected if not set) |
| `APP_PATH` | No | Frontend app path prefix if served under a subpath |

### Installation

```bash
# Install dependencies
npm install

# Push database schema
npm run push -w lib/db

# Start the API server
npm run dev -w artifacts/api-server

# Start the frontend (separate terminal)
npm run dev -w artifacts/licensing-app
```

### First Login

Authentication is handled by Azure Easy Auth at the infrastructure level. Once authenticated, you'll land on the dashboard.

Go to **Settings** to:

1. Set a **GitHub Personal Access Token** (fine-grained PAT with Contents read + Metadata read on your plugin repos)
2. Note or regenerate the **API key** (used by your WP plugin to list available products)

## Architecture

```
├── artifacts/
│   ├── api-server/            # Express 5 API server
│   │   └── src/
│   │       ├── routes/        # Auth, admin CRUD, public licensing API
│   │       ├── middlewares/   # Auth, CSRF protection
│   │       └── lib/           # Easy auth, GitHub poller, encryption, rate limiting
│   └── licensing-app/         # React + Vite admin frontend
│       └── src/
│           ├── pages/         # Dashboard, Clients, Products, Product Detail, Settings
│           └── hooks/         # Centralized mutation hooks with cache invalidation
├── lib/
│   ├── api-spec/              # OpenAPI 3.1 spec + Orval codegen config
│   ├── api-client-react/      # Generated React Query hooks
│   ├── api-zod/               # Generated Zod validation schemas
│   └── db/                    # Drizzle ORM schema + connection
└── scripts/                   # Seed admin, clear settings
```

## Security

- **Authentication**: Azure Easy Auth (infrastructure-level, via request headers)
- **Session**: Server-side sessions stored in PostgreSQL, `httpOnly` + `secure` + `sameSite` cookies
- **CSRF**: Double-submit cookie pattern with timing-safe comparison
- **Headers**: Helmet middleware for security headers (X-Content-Type-Options, X-Frame-Options, etc.)
- **Encryption**: AES-256-CBC for stored secrets (GitHub PAT, API key)
- **Rate Limiting**: 60 requests/hour per IP on the license validation endpoint
- **CORS**: Configurable allowed origins via `CORS_ORIGIN` environment variable
- **API Key Comparison**: Timing-safe to prevent timing attacks

## Public API

These endpoints are called by your WordPress plugins. No admin session required.

### `GET /api/status`

Health check. Returns `{ "status": "ok" }`.

### `POST /api/validate`

Validate a license key against a domain.

```json
// Request body
{ "key": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", "fingerprint": "example.com" }

// Response
{ "data": { "valid": true } }
```

Rate limited to 60 requests per hour per IP.

### `GET /api/update-check`

Check if a newer version is available for a product.

| Parameter | Description |
|---|---|
| `product_id` | Product ID (numeric) |
| `license` | License key UUID |
| `fingerprint` | The site's domain |

Returns version info, download URL, WP compatibility data, and changelog. Returns `{ "version": null }` if no update or invalid license.

### `GET /api/download`

Download the product ZIP. Same parameters as update-check. Proxies the download from GitHub with token authentication. Returns `403` for invalid licenses.

### `GET /api/products`

List available products. Requires `Authorization: Bearer <api-key>` header using the API key from Settings.

## Admin API

All admin endpoints require authentication (Easy Auth or dev session) and CSRF token (`x-csrf-token` header matching `finn.csrf` cookie).

- `GET/POST /api/admin/clients` — List/create clients
- `GET/PUT/DELETE /api/admin/clients/:id` — Get/update/delete client
- `GET/POST /api/admin/products` — List/create products
- `GET/PUT/DELETE /api/admin/products/:id` — Get/update/delete product
- `GET /api/admin/products/:id/releases` — List all synced releases
- `POST /api/admin/products/:id/poll` — Sync releases from GitHub
- `GET/POST /api/admin/licenses` — List/create licenses
- `GET/PUT/DELETE /api/admin/licenses/:id` — Get/update/delete license
- `POST /api/admin/licenses/:id/toggle` — Toggle active/revoked
- `GET/PUT /api/admin/settings` — Get/update settings
- `POST /api/admin/settings/regenerate-api-key` — Regenerate API key

## Development

### Regenerate API client after spec changes

```bash
npm run codegen -w lib/api-spec
```

### Type checking

```bash
npm run typecheck
```

### Database

The schema is defined in `lib/db/src/schema/`. Tables: `finn_clients`, `finn_products`, `finn_releases`, `finn_licenses`, `finn_settings`, `finn_users`, `finn_sessions`.

```bash
# Push schema changes
npm run push -w lib/db
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS, shadcn/ui, wouter, React Query |
| Backend | Express 5, TypeScript |
| Database | PostgreSQL, Drizzle ORM |
| Auth | Azure Easy Auth, express-session |
| Security | Helmet, CSRF double-submit, timing-safe comparisons |
| Validation | Zod, drizzle-zod |
| API Codegen | Orval (OpenAPI 3.1) |
| Build | esbuild |
