# Deployment & Netlify + Neon setup

This document describes recommended steps to deploy the NV Group Asset Management app to Netlify with a Neon (Postgres) database, required environment variables, and a suggested migration for `external_id`.

## Required environment variables (Netlify site settings)
- DATABASE_URL (optional) — the Postgres connection string. Prefer using Neon unpooled connection for serverless functions.
- NETLIFY_DATABASE_URL_UNPOOLED — recommended: Neon-provided unpooled connection string for serverless functions.

If you provide both, the functions prefer `DATABASE_URL` then `NETLIFY_DATABASE_URL` then `NETLIFY_DATABASE_URL_UNPOOLED`.

## Node version
Set the Netlify project's Node version to match the project's `package.json` `engines.node` if present (Node 18 recommended for compatibility). In Netlify UI: "Site settings » Build & deploy » Environment » Environment variables" add `NODE_VERSION` or configure `.node-version`.

## Neon pooling guidance
Neon recommends using an *unpooled* connection string for serverless functions. Use the `NETLIFY_DATABASE_URL_UNPOOLED` variable set to the Neon unpooled URL.

## Migration: add `external_id` column
To preserve external/external-imported IDs, add an `external_id` column to each asset table.

Example migration SQL (run with your DB migration tool or psql):

-- migrations/001_add_external_id.sql
BEGIN;

ALTER TABLE laptops ADD COLUMN IF NOT EXISTS external_id TEXT;
CREATE INDEX IF NOT EXISTS idx_laptops_external_id ON laptops (external_id);

ALTER TABLE monitors ADD COLUMN IF NOT EXISTS external_id TEXT;
CREATE INDEX IF NOT EXISTS idx_monitors_external_id ON monitors (external_id);

ALTER TABLE printers ADD COLUMN IF NOT EXISTS external_id TEXT;
CREATE INDEX IF NOT EXISTS idx_printers_external_id ON printers (external_id);

ALTER TABLE cameras ADD COLUMN IF NOT EXISTS external_id TEXT;
CREATE INDEX IF NOT EXISTS idx_cameras_external_id ON cameras (external_id);

ALTER TABLE wifi ADD COLUMN IF NOT EXISTS external_id TEXT;
CREATE INDEX IF NOT EXISTS idx_wifi_external_id ON wifi (external_id);

COMMIT;

Notes:
- `external_id` is nullable and indexed to allow efficient lookups by external identifiers.
- If you want uniqueness guarantees, consider `CREATE UNIQUE INDEX ... WHERE external_id IS NOT NULL` but be careful: duplicates in your imported data will break the migration unless cleaned first.

## Deploy steps
1. Push the code to GitHub (or other Git provider).
2. In Netlify, create a new Site from Git and connect to the repo.
3. In Netlify site settings, add the environment variables:
   - `NETLIFY_DATABASE_URL_UNPOOLED` = (Neon unpooled connection string)
   - Optionally set `DATABASE_URL` or `NETLIFY_DATABASE_URL`.
4. Set the Node version (if needed) in Netlify build settings.
5. Run DB migrations (the SQL above) against your Neon DB.
6. Deploy and monitor function logs in Netlify to ensure DB connections succeed.

## Troubleshooting
- If you see connection errors mentioning `127.0.0.1` or `localhost`, ensure your `DATABASE_URL`/environment variables are set to the remote Neon connection string (not localhost).
- For serverless connection issues, prefer the unpooled Neon URL.

## Security
- Never commit production credentials to the repository. Store them only in Netlify environment variables.
- Review function logs (Netlify UI) for any sensitive information before sharing.

---
