# Gate 11 Manual Proof Checklist (Fallback)

Playwright is not available in this environment (`require('playwright')` failed and `npx playwright --version` could not install due registry access restrictions), so use this manual checklist to capture proof from Preview.

## Required screenshots
1. `/dashboard/wardrobe?debug=1`
   - Experimental features panel visible
   - Shows `BG Removal: ON/OFF` and `Avatar v2: ON/OFF`
2. `/dashboard/wardrobe`
   - BG toggle visible when `NEXT_PUBLIC_BG_REMOVAL=1`
   - Buttons visible:
     - Select from library
     - Take Photos
3. `/dashboard/wardrobe` during upload of 3 files
   - Queue panel visible (`upload-queue-panel`)
   - Per-item states present (queued/uploading/saving/tagging/done or failed)
4. `/dashboard/avatar?debug=1`
   - Experimental panel visible
   - Avatar v2 container visible when flag enabled (`avatar-v2-enabled`)
   - Fit controls visible (`avatar-fit-controls`)
   - Overlay nodes visible when latest outfit exists (`outfit-overlay-top|bottom|shoes`)

## Runtime log signatures to collect from Vercel
Capture timestamped entries for:
- `POST /api/wardrobe/blob`
- `POST /api/wardrobe-normalize`
- `POST /api/wardrobe/items`
- `POST /api/ai/wardrobe/tag` (single item tag/re-tag)
- `POST /api/ai/wardrobe/tag-batch` (bulk action, chunked possible)
- `POST /api/ai/outfit`

## Manual verification flow
1. Ensure Preview env vars are set and deployment was rebuilt:
   - `NEXT_PUBLIC_DEBUG_FLAGS=1`
   - `NEXT_PUBLIC_BG_REMOVAL=1`
   - `NEXT_PUBLIC_AVATAR_V2=1`
2. Login as smoke user.
3. Upload 3 images via library; verify queue lifecycle and item creation.
4. Use **Take Photos** repeatedly on mobile for 3 captures; verify queue appends entries.
5. Trigger **Auto-tag my closet**; confirm tag-batch runtime logs.
6. Generate outfit from `/dashboard/outfits`; confirm outfit runtime log.
7. Open avatar page; confirm Avatar v2 + fit controls + overlays.

## Notes
- `?debug=1` is readout-only; it must not force-enable features.
- BG removal and Avatar v2 should activate only when their respective env flags are enabled.
