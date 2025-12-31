'use client';

import { useState, useEffect } from 'react';
import Button from '../../../components/Button';
import Card from '../../../components/Card';
import { generateOutfit } from '../../../lib/outfit';

interface Outfit {
  top: string;
  bottom: string;
  shoe: string;
  score: number;
  explanation: string;
}

export default function Page() {
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [isPaid, setIsPaid] = useState<boolean>(false);

  useEffect(() => {
    const stored = localStorage.getItem('outfits');
    if (stored) {
      setOutfits(JSON.parse(stored));
    }
    const paid = localStorage.getItem('isPaid');
    if (paid === 'true') {
      setIsPaid(true);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('outfits', JSON.stringify(outfits));
  }, [outfits]);

  const handleGenerate = () => {
    if (!isPaid && outfits.length >= 5) {
      alert('Upgrade to Pro to generate more outfits.');
      return;
    }
    const outfit = generateOutfit();
    setOutfits([...outfits, outfit]);
  };

  return (
    <div className="space-y-l">
      <h1 className="text-3xl font-bold">Outfits</h1>
      <p className="text-deep-espresso/80">Generate outfit ideas based on your wardrobe.</p>
      <Button variant="primary" onClick={handleGenerate}>Generate Outfit</Button>
      {!isPaid && outfits.length >= 5 && (
        <p className="text-pastel-coral font-semibold">You have reached the free limit. Upgrade to unlock unlimited outfits.</p>
      )}
      <div className="space-y-m">
        {outfits.map((o, index) => (
          <Card key={index}>
            <div className="space-y-s">
              <div><strong>Top:</strong> {o.top}</div>
              <div><strong>Bottom:</strong> {o.bottom}</div>
              <div><strong>Shoes:</strong> {o.shoe}</div>
              <div className="text-sm text-deep-espresso/70"><em>{o.explanation}</em></div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
