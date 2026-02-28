# Gate 11 CI Proof Runner

This repo includes a manual GitHub Actions workflow to run Gate 11 proof checks against a Vercel Preview URL.

## Required GitHub repository secrets
Set these secrets in **Settings → Secrets and variables → Actions**:

- `SMOKE_EMAIL` (required)
- `SMOKE_PASSWORD` (required)
- `VERCEL_PROTECTION_BYPASS` (optional; only for protected previews)

## How to run
1. Open **Actions** tab.
2. Select workflow: **Gate 11 Proof**.
3. Click **Run workflow**.
4. Provide `base_url` as the Preview URL (for the Gate 11 branch deployment).
5. Optionally provide `vercel_protection_bypass` to override the secret value for this run.

## What it runs
- `node .codex/gate-11-proof.mjs`
- `node .codex/gate-10.2x-smoke.mjs`

Both outputs are captured to:

- `.codex/artifacts/gate-11/ci-gate-11-proof.txt`
- `.codex/artifacts/gate-11/ci-gate-10.2x-smoke.txt`

and uploaded as workflow artifacts.

## PR proof usage
- Copy the workflow **Job Summary** into PR comments.
- Attach or link uploaded artifacts for full logs.
- Include runtime Vercel log verification for:
  - `POST /api/ai/wardrobe/tag`
  - `POST /api/ai/wardrobe/tag-batch`
  - `POST /api/ai/outfit`
  - upload pipeline endpoints (`/api/wardrobe/blob`, `/api/wardrobe-normalize`, `/api/wardrobe/items`).
