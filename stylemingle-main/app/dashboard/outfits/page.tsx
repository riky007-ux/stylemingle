'use client';

import { useEffect, useState } from 'react';
import Button from '@/components/Button';
import Card from '@/components/Card';
import { generateOutfit, type Outfit } from '@/lib/outfit';
import { FREE_OUTFIT_LIMIT_PER_DAY, canGenerateOutfit, incrementOutfitCount } from '@/lib/tier';

export default function Page() {
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [lastOutfit, setLastOutfit] = useState<Outfit | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [isPaid, setIsPaid] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('outfits');
    if (stored) {
      const parsed: Outfit[] = JSON.parse(stored);
      setOutfits(parsed);
      if (parsed.length > 0) {
        setLastOutfit(parsed[0]);
      }
    }
    const paidFlag = localStorage.getItem('isPaid');
    if (paidFlag === 'true') {
      setIsPaid(true);
    }
  }, []);

  const handleGenerate = () => {
    if (!isPaid && !canGenerateOutfit(isPaid)) {
      setShowUpgrade(true);
      return;
    }
    const newOutfit = generateOutfit();
    const newOutfits = [newOutfit, ...outfits];
    setOutfits(newOutfits);
    setLastOutfit(newOutfit);
    localStorage.setItem('outfits', JSON.stringify(newOutfits));
    incrementOutfitCount(isPaid);
  };

  const handleClear = () => {
    setOutfits([]);
    setLastOutfit(null);
    localStorage.removeItem('outfits');
  };

  return (
    <div className="space-y-l">
      <h1 className="text-3xl font-bold">Outfits</h1>
      <p className="text-deep-espresso/80">Generate outfit ideas based on your wardrobe.</p>
      <Button variant="primary" onClick={handleGenerate}>Generate Outfit</Button>
      {!isPaid && showUpgrade && (
        <p className="text-pastel-coral font-semibold">
          You have reached the free daily limit of {FREE_OUTFIT_LIMIT_PER_DAY} outfits. Upgrade to unlock unlimited outfits.
        </p>
      )}
      {lastOutfit && (
        <p className="text-green-600 font-semibold">
          This outfit is now on your avatar.
        </p>
      )}
      <div className="space-y-m">
        {outfits.map((o, index) => (
          <Card key={index}>
            <div className="space-y-s">
              <div><strong>Top:</strong> {o.top}</div>
              <div><strong>Bottom:</strong> {o.bottom}</div>
              <div><strong>Shoes:</strong> {o.shoe}</div>
              {o.accessory && <div><strong>Accessory:</strong> {o.accessory}</div>}
              <div className="text-sm text-deep-espresso/70"><em>{o.explanation}</em></div>
            </div>
          </Card>
        ))}
      </div>
      {outfits.length > 0 && (
        <Button variant="secondary" onClick={handleClear}>Clear Outfits</Button>
      )}
    </div>
  );
}
