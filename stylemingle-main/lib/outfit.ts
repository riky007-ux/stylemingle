const tops = [
  { name: 'T-shirt', color: 'light' },
  { name: 'Blouse', color: 'light' },
  { name: 'Sweater', color: 'dark' },
];

const bottoms = [
  { name: 'Jeans', color: 'dark' },
  { name: 'Skirt', color: 'light' },
  { name: 'Shorts', color: 'light' },
];

const shoes = [
  { name: 'Sneakers', color: 'light' },
  { name: 'Boots', color: 'dark' },
  { name: 'Heels', color: 'light' },
];

export interface Outfit {
  top: string;
  bottom: string;
  shoe: string;
  score: number;
  explanation: string;
}

export function generateOutfit(): Outfit {
  const top = tops[Math.floor(Math.random() * tops.length)];
  const bottom = bottoms[Math.floor(Math.random() * bottoms.length)];
  const shoe = shoes[Math.floor(Math.random() * shoes.length)];
  let score = 0;
  if (top.color === bottom.color) score += 1;
  if (bottom.color === shoe.color) score += 1;
  if (top.color === shoe.color) score += 1;
  let explanation = '';
  if (score >= 2) {
    explanation = 'Colors harmonize well, creating a cohesive look.';
  } else if (score === 1) {
    explanation = 'Some colors match, adding subtle harmony.';
  } else {
    explanation = 'Contrasting colors for a bold outfit.';
  }
  return {
    top: top.name,
    bottom: bottom.name,
    shoe: shoe.name,
    score,
    explanation,
  };
}
