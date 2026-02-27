const CACHE_KEY = "sm:enhancedImageMap";

export type EnhancedImageMap = Record<string, string>;

export function readEnhancedImageMap(): EnhancedImageMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function writeEnhancedImageMap(map: EnhancedImageMap) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CACHE_KEY, JSON.stringify(map));
}

export function setEnhancedImage(itemId: string, imageUrl: string) {
  const map = readEnhancedImageMap();
  map[itemId] = imageUrl;
  writeEnhancedImageMap(map);
}
