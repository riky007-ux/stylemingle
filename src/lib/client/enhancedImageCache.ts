const CACHE_KEY = "sm:enhancedImageMap";
const MAX_ENTRIES = 20;

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

  try {
    const trimmedEntries = Object.entries(map).slice(-MAX_ENTRIES);
    const trimmedMap = Object.fromEntries(trimmedEntries);
    localStorage.setItem(CACHE_KEY, JSON.stringify(trimmedMap));
  } catch {
    // best-effort cache; never block upload/tag flows
  }
}

export function setEnhancedImage(itemId: string, imageUrl: string) {
  const map = readEnhancedImageMap();
  if (itemId in map) {
    delete map[itemId];
  }
  map[itemId] = imageUrl;
  writeEnhancedImageMap(map);
}
