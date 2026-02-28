# Gate 11 QA Checklist (Premium Wardrobe Experience)

## Preview env vars (Vercel)
Set these on **Preview** environment and redeploy:

- `NEXT_PUBLIC_DEBUG_FLAGS=1`
- `NEXT_PUBLIC_BG_REMOVAL=1`
- `NEXT_PUBLIC_AVATAR_V2=1`

## Manual test steps

### 1) Library multi-upload queue
1. Sign in and open `/dashboard/wardrobe`.
2. Click **Select from library** and choose 5 photos.
3. Verify queue appears and each item transitions through statuses:
   - `queued -> normalizing -> uploading -> saving -> tagging -> done` (or `failed`).
4. Verify saved items appear in the wardrobe grid.
5. Verify failed tagging still leaves saved item and **Retry tag** is available.

### 2) Camera batch capture
1. On mobile Safari/Chrome, tap **Take Photos**.
2. Capture one photo, return, repeat 3 times.
3. Verify each captured photo appends into the same queue.

### 3) Bulk auto-tag behavior
1. Click **Auto-tag my closet**.
2. Verify progress updates in UI.
3. In Vercel runtime logs, verify `POST /api/ai/wardrobe/tag-batch` appears (chunked calls are expected).

### 4) Outfit generation behavior
1. Open `/dashboard/outfits` and generate an outfit.
2. Verify recommendation appears.
3. In Vercel runtime logs, verify `POST /api/ai/outfit` appears.

### 5) Avatar v2 visibility
1. Open `/dashboard/avatar`.
2. Verify experimental indicator shows Avatar v2 ON/OFF.
3. With `NEXT_PUBLIC_AVATAR_V2=1`, verify:
   - Avatar v2 is visible.
   - Overlay layers appear for top/bottom/shoes when latest outfit exists.
   - **Adjust fit** controls are visible.
4. Adjust one slider, refresh page, confirm fit persists.

### 6) Background removal validation
1. On `/dashboard/wardrobe`, ensure **Enhance photo (remove background)** toggle is visible.
2. Upload 1+ image with enhancement ON.
3. Verify thumbnail renders correctly (no broken data/blob previews).
4. Optionally click per-item **Enhance** action to test existing-item enhancement.

## Expected Vercel runtime log signatures
Look for these request lines and timestamp each one in QA notes:

- `POST /api/ai/wardrobe/tag` (single item tag/re-tag)
- `POST /api/ai/wardrobe/tag-batch` (bulk auto-tag)
- `POST /api/ai/outfit` (outfit generation)
- (Upload path sanity) `POST /api/wardrobe/blob`, `POST /api/wardrobe/items`

## Quick visual confirmation checklist
- Wardrobe queue shows compact summary: `queued • uploading • tagging • failed`
- Camera capture button exists and supports repeated additions
- Experimental flags panel visible when `NEXT_PUBLIC_DEBUG_FLAGS=1`
- Avatar overlay + fit controls visible when Avatar v2 is enabled
