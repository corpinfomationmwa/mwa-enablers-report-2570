# MWA Enablers Report 2570 — Cloudflare Pages Frontend Prep

This package contains only the Vite/React frontend source and its build configuration.
It intentionally excludes the Supabase Edge Function, Google Apps Script, database schema,
credentials, and duplicate project snapshots. No production system was changed or deployed.

## Cloudflare Pages build settings

- Framework preset: Vite
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `/` (repository/package root)
- Recommended Node version: 22 (set `NODE_VERSION=22` if needed)

## Required build-time environment variables

Set these in Cloudflare Pages project settings for both Production and Preview as appropriate:

- `VITE_SUPABASE_URL` — existing Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — existing publishable/anon key only
- `VITE_ENABLERS_GAS_API_URL` — existing Enablers 2570 Google Apps Script Web App `/exec` URL

Never put `SUPABASE_SERVICE_ROLE_KEY`, `MWA_ENABLERS_ADMIN_KEY`, or any other server secret in a `VITE_*` variable or frontend bundle.
`GEMINI_API_KEY` in the original example is not referenced by the frontend source found during this review, so it is not included as a required Cloudflare variable.

## Before production cutover

1. Build and deploy to a separate Cloudflare Pages preview URL first.
2. Verify Supabase reads/writes and the existing Edge Function.
3. Verify Apps Script sync to Google Sheets, Drive evidence uploads, PDF generation, and email delivery.
4. Verify failure states do not report a successful save/email when the backend has not confirmed it.
5. Only switch the production URL after approval.

## Review status

- Static syntax transpilation: 24 TypeScript/TSX files checked; no transpile diagnostics.
- Full `npm run build`: NOT verified in this environment because npm registry access failed (`EAI_AGAIN`) during dependency installation.
- Live Supabase / Google Apps Script integration: NOT tested.
- Production deployment or system changes: NOT performed.
