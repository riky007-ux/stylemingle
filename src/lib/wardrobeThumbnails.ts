// src/lib/wardrobeThumbnails.ts

/**
 * Derives a public, cacheable thumbnail URL from a Vercel Blob image URL.
 *
 * This uses Vercel Blob image transforms (edge-optimized):
 * - width: 400
 * - height: 400
 * - fit: cover
 * - quality: 75
 *
 * IMPORTANT:
 * - Original blob remains the source of truth
 * - No auth, cookies, or redirects involved
 * - Safe to use directly in <img src="...">
 */
export function getThumbnailUrl(imageUrl: string): string {
  try {
    const url = new URL(imageUrl);

    url.searchParams.set("w", "400");
    url.searchParams.set("h", "400");
    url.searchParams.set("fit", "cover");
    url.searchParams.set("q", "75");

    return url.toString();
  } catch {
    // If the imageUrl is malformed for any reason,
    // fall back to the original URL so the UI never breaks.
    return imageUrl;
  }
}
