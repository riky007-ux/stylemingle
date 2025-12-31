export type Tier = 'free' | 'paid';

export const FREE_OUTFIT_LIMIT_PER_DAY = 2;

export function getUserTier(): Tier {
  if (typeof window !== 'undefined') {
    const tier = localStorage.getItem('tier') as Tier | null;
    return tier ?? 'free';
  }
  return 'free';
}

export function getOutfitCount(): number {
  if (typeof window !== 'undefined') {
    const record = JSON.parse(localStorage.getItem('outfitGenRecord') || 'null') as { date: string; count: number } | null;
    const today = new Date().toDateString();
    if (!record || record.date !== today) {
      return 0;
    }
    return record.count ?? 0;
  }
  return 0;
}

export function incrementOutfitCount(): void {
  if (typeof window !== 'undefined') {
    const today = new Date().toDateString();
    const record = JSON.parse(localStorage.getItem('outfitGenRecord') || 'null') as { date: string; count: number } | null;
    if (!record || record.date !== today) {
      localStorage.setItem('outfitGenRecord', JSON.stringify({ date: today, count: 1 }));
    } else {
      localStorage.setItem('outfitGenRecord', JSON.stringify({ date: today, count: record.count + 1 }));
    }
  }
}

export function canGenerateOutfit(isPaid: boolean): boolean {
  if (isPaid) return true;
  return getOutfitCount() < FREE_OUTFIT_LIMIT_PER_DAY;
}
