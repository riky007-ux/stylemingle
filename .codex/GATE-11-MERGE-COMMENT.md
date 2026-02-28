# Gate 11 Merge-Ready Comment Template

## Gate 11 Proof + QA Status

- Preview URL tested: `<BASE_URL>`
- GitHub Action run: **Gate 11 Proof**
- gate-11-proof.mjs: `<PASS|FAIL>`
- gate-10.2x-smoke.mjs: `<PASS|FAIL>`
- Artifacts: `gate-11-proof-artifacts` (contains `ci-gate-11-proof.txt` and `ci-gate-10.2x-smoke.txt`)

## Preview flags used
Set in Vercel **Preview** env vars and redeploy:
- `NEXT_PUBLIC_DEBUG_FLAGS=1`
- `NEXT_PUBLIC_BG_REMOVAL=1`
- `NEXT_PUBLIC_AVATAR_V2=1`

## Manual screenshots attached
1. `/dashboard/wardrobe?debug=1` (experimental panel visible)
2. `/dashboard/wardrobe` (BG toggle + upload controls visible)
3. `/dashboard/wardrobe` during upload (queue panel + lifecycle)
4. `/dashboard/avatar?debug=1` (Avatar v2 + fit controls + overlays)

## Vercel runtime log signatures captured
- `POST /api/ai/wardrobe/tag-batch`
- `POST /api/ai/outfit`
- `POST /api/wardrobe/upload`

## Production safety
- BG removal and Avatar v2 remain feature-flagged.
- Production behavior stays unchanged unless flags are explicitly enabled.
