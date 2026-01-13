'use client';
import React from 'react';
import { avatarExpressions, AvatarExpression } from './avatarExpressions';
import { avatarTops, avatarBottoms } from './avatarClothing';
import { avatarHair, AvatarHairKey } from './avatarHair';

export type AvatarSize = 'S' | 'M' | 'L' | 'XL';

type AvatarTopName = keyof typeof avatarTops;
type AvatarBottomName = keyof typeof avatarBottoms;

interface AvatarOutfit {
  top?: AvatarTopName;
  bottom?: AvatarBottomName;
}

interface AvatarProps {
  size?: AvatarSize;
  expression?: AvatarExpression;
  outfit?: AvatarOutfit;
  hair?: AvatarHairKey;
}

const sizeDimensions: Record<AvatarSize, { torsoWidth: number; hipWidth: number; shoulderWidth: number }> = {
  S: { torsoWidth: 40, hipWidth: 40, shoulderWidth: 40 },
  M: { torsoWidth: 50, hipWidth: 50, shoulderWidth: 50 },
  L: { torsoWidth: 60, hipWidth: 60, shoulderWidth: 60 },
  XL: { torsoWidth: 70, hipWidth: 70, shoulderWidth: 70 },
};

const Avatar: React.FC<AvatarProps> = ({ size = 'M', expression = 'neutral', outfit, hair = 'none' }) => {
  const dims = sizeDimensions[size];
  const variant = avatarExpressions[expression] ?? avatarExpressions.neutral;
  const shoulderX = (200 - dims.shoulderWidth) / 2;
  const torsoX = (200 - dims.torsoWidth) / 2;
  const hipX = (200 - dims.hipWidth) / 2;
  const topElement = outfit?.top ? avatarTops[outfit.top][size] : null;
  const bottomElement = outfit?.bottom ? avatarBottoms[outfit.bottom][size] : null;
  const hairElement = avatarHair[hair][size] ?? null;

  return (
    <svg width="200" height="400" viewBox="0 0 200 400" xmlns="http://www.w3.org/2000/svg">
      {/* Base body layer */}
      <g id="base-body" fill="#f5c6a5">
        {/* Shoulders */}
        <rect x={shoulderX} y={80} width={dims.shoulderWidth} height={40} />
        {/* Torso */}
        <rect x={torsoX} y={120} width={dims.torsoWidth} height={80} />
        {/* Hips */}
        <rect x={hipX} y={200} width={dims.hipWidth} height={40} />
        {/* Legs */}
        <rect x={70} y={260} width={25} height={100} />
        <rect x={105} y={260} width={25} height={100} />
      </g>
      {/* Clothing layer */}
      <g id="clothing">
        {topElement}
        {bottomElement}
      </g>
      {/* Hair layer */}
      <g id="hair">
        {hairElement}
      </g>
      {/* Face layer */}
      <g id="face">
        {/* Head circle */}
        <circle cx="100" cy="60" r="30" fill="#f5c6a5" />
        {/* Eyes */}
        <circle cx="90" cy="55" r="4" fill="#000" />
        <circle cx="110" cy="55" r="4" fill="#000" />
        {/* Brows */}
        <line x1="82" y1="45" x2="98" y2="45" stroke="#000" strokeWidth="2" />
        <line x1="102" y1="45" x2="118" y2="45" stroke="#000" strokeWidth="2" />
        {/* Nose */}
        <line x1="100" y1="55" x2="100" y2="65" stroke="#000" strokeWidth="2" />
        {/* Mouth (variant) */}
        {variant}
      </g>
    </svg>
  );
};

export default Avatar;
