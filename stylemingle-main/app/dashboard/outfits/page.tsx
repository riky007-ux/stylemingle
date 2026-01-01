'use client'

import { useState, useEffect } from 'react'
import Button from '../../../components/Button'
import Card from '../../../components/Card'
import { generateOutfit } from '../../../lib/outfit'
import type { Outfit } from '../../../lib/outfit'
import { canGenerateOutfit, incrementOutfitCount, FREE_OUTFIT_LIMIT_PER_DAY } from '../../../lib/tier'

export default function Page() {
  const [outfits, setOutfits] = useState<Outfit[]>([])
  const [isPaid, setIsPaid] = useState<boolean>(false)
  const [lastOutfit, setLastOutfit] = useState<Outfit | null>(null)
  const [showUpgrade, setShowUpgrade] = useState<boolean>(false)

  useEffect(() => {
    const stored = localStorage.getItem('outfits')
    if (stored) {
      try {
        setOutfits(JSON.parse(stored))
      } catch {}
    }
    const paid = localStorage.getItem('isPaid')
    if (paid === 'true') {
      setIsPaid(true)
    }
    const storedLast = localStorage.getItem('lastOutfit')
    if (storedLast) {
      try {
        setLastOutfit(JSON.parse(storedLast))
      } catch {}
    }
  }, [])

  const handleGenerate = () => 
    if (!isPaid && !canGenerateOutfit(isPaid))) 
      setShowUpgrade(true)
      return
    }
    const newOutfit = generateOutfit()
    if (!isPaid) {
      incrementOutfitCount()
    }
    const newOutfits = [newOutfit, ...outfits]
    setOutfits(newOutfits)
    localStorage.setItem('outfits', JSON.stringify(newOutfits))
    localStorage.setItem('lastOutfit', JSON.stringify(newOutfit))
    setLastOutfit(newOutfit)
    setShowUpgrade(false)
  }

  const handleClear = () => {
    setOutfits([])
    localStorage.removeItem('outfits')
  }

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
        <p className="text-green-600 font-semibold">This outfit is now on your avatar.</p>
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
    </div>
  )
}
