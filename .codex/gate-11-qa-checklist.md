# Gate 11 QA Checklist (Premium Wardrobe Experience)

## Preview env vars (Vercel)
Set these on **Preview** and redeploy:

- `NEXT_PUBLIC_DEBUG_FLAGS=1`
- `NEXT_PUBLIC_BG_REMOVAL=1`
- `NEXT_PUBLIC_AVATAR_V2=1`

## Confirm flags are active
1. Open `/dashboard/wardrobe` and `/dashboard/avatar`.
2. Confirm the **Experimental features** panel is visible.
3. Confirm panel reads:
   - `BG Removal: ON`
   - `Avatar v2: ON`

> Safe fallback: add `?debug=1` to the URL to force only the flag readout panel visible for QA checks.
> This query param does **not** enable BG removal or Avatar v2 logic.

## Manual test steps

### 1) Library multi-upload queue
1. Sign in and open `/dashboard/wardrobe`.
2. Click **Select from library** and choose 5 photos.
3. Verify queue panel appears (`data-testid="upload-queue-panel"`).
4. Verify each item transitions statuses:
   - `queued -> normalizing -> uploading -> saving -> tagging -> done` (or `failed`).
5. Verify saved items appear in wardrobe grid.
6. If tagging fails, verify **Retry tag** appears and item remains saved.

### 2) Camera batch capture
1. On mobile Safari/Chrome, tap **Take Photos** (`data-testid="wardrobe-upload-camera"`).
2. Capture one photo, return, repeat 3 times.
3. Verify each capture appends into the same queue.

### 3) Bulk auto-tag behavior
1. Click **Auto-tag my closet**.
2. Verify progress updates in UI.
3. In Vercel logs, confirm `POST /api/ai/wardrobe/tag-batch` (chunked calls are expected).

### 4) Outfit generation behavior
1. Open `/dashboard/outfits` and generate an outfit.
2. Verify recommendation appears.
3. In Vercel logs, confirm `POST /api/ai/outfit`.

### 5) Avatar v2 visibility + fit controls
1. Open `/dashboard/avatar`.
2. With `NEXT_PUBLIC_AVATAR_V2=1`, verify:
   - Avatar container has `data-testid="avatar-v2-enabled"`.
   - Fit controls visible (`data-testid="avatar-fit-controls"`).
   - Overlay nodes render when latest outfit exists:
     - `data-testid="outfit-overlay-top"`
     - `data-testid="outfit-overlay-bottom"`
     - `data-testid="outfit-overlay-shoes"`
3. Change one fit slider, refresh, confirm persistence.

### 6) Background removal validation
1. On `/dashboard/wardrobe`, verify **Enhance photo (remove background)** toggle appears.
2. Upload 1+ image with enhancement ON.
3. Verify thumbnail renders correctly (no broken data/blob previews).
4. Optionally click per-item **Enhance** to test existing-item enhancement.

## Expected Vercel runtime log signatures
For upload of 3 images:
- `POST /api/wardrobe/blob`
- `POST /api/wardrobe-normalize` (if normalize route is used by client/server pipeline for those images)
- `POST /api/wardrobe/items`
- `POST /api/ai/wardrobe/tag`

For bulk action:
- `POST /api/ai/wardrobe/tag-batch` (possibly multiple chunked calls)

For outfit generation:
- `POST /api/ai/outfit`

## Proof scripts
- Baseline smoke: `.codex/gate-10.2x-smoke.mjs`
- Gate 11 proof: `.codex/gate-11-proof.mjs`

Example:

```bash
BASE_URL="https://<preview-url>" \
SMOKE_EMAIL="..." \
SMOKE_PASSWORD="..." \
VERCEL_PROTECTION_BYPASS="..." \
node .codex/gate-11-proof.mjs
```
