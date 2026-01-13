import type { AvatarOutfit, AvatarTopKey, AvatarBottomKey } from './avatarClothing';

// Define normalized category strings that should map to the avatar top.
// These values are lower‑cased when compared.
const TOP_CATEGORIES: string[] = [
  'top',
  'tshirt',
  'tee',
  'shirt',
  'blouse',
  'jacket',
  'coat',
  'sweater',
  'hoodie',
  'sweatshirt',
];

// Define normalized category strings that should map to the avatar bottom.
const BOTTOM_CATEGORIES: string[] = [
  'bottom',
  'pants',
  'jeans',
  'trousers',
  'shorts',
  'skirt',
  'slacks',
];

/**
 * Normalize a raw category string. Converts to lower case and trims whitespace.
 */
function normalizeCategory(category: string | null | undefined): string {
  return (category ?? '').toString().trim().toLowerCase();
}

/**
 * Determine the avatar clothing keys for a given array of wardrobe categories.
 *
 * @param categories An array of category strings from wardrobe items or AI outfit parts.
 * @returns An AvatarOutfit with deterministic top and bottom keys.
 */
export function mapCategoriesToAvatarOutfit(categories: Array<string | null | undefined>): AvatarOutfit {
  let topKey: AvatarTopKey | undefined;
  let bottomKey: AvatarBottomKey | undefined;

  // Normalize all categories once.
  const normalized = categories.map((c) => normalizeCategory(c));

  // Determine topKey by checking membership in TOP_CATEGORIES.
  for (const cat of normalized) {
    if (!topKey && TOP_CATEGORIES.includes(cat)) {
      // The only available avatar top is "tshirt-basic".
      topKey = 'tshirt-basic';
    }
  }

  // Determine bottomKey by checking membership in BOTTOM_CATEGORIES.
  for (const cat of normalized) {
    if (!bottomKey && BOTTOM_CATEGORIES.includes(cat)) {
      // The only available avatar bottom is "jeans-basic".
      bottomKey = 'jeans-basic';
    }
  }

  // Apply neutral fallback if keys are still undefined.
  if (!topKey) {
    topKey = 'tshirt-basic';
  }
  if (!bottomKey) {
    bottomKey = 'jeans-basic';
  }

  return {
    top: topKey,
    bottom: bottomKey,
  };
}
