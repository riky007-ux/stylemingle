'use client';
import React from 'react';
import { avatarExpressions, AvatarExpression } from './avatarExpressions';

export type AvatarSize = 'S' | 'M' | 'L' | 'XL';

interface AvatarProps {
  size?: AvatarSize;
  expression?: AvatarExpression;
}

const sizeDimensions: Record<AvatarSize, { torsoWidth: number; hipWidth: number; shoulderWidth: number }> = {
  S: { torsoWidth: 40, hipWidth: 40, shoulderWidth: 40 },
  M: { torsoWidth: 50, hipWidth: 50, shoulderWidth: 50 },
  L: { torsoWidth: 60, hipWidth: 60, shoulderWidth: 60 },
  XL: { torsoWidth: 70, hipWidth: 70, shoulderWidth: 70 },
};

const Avatar: React.FC<AvatarProps> = ({ size = 'M', expression = 'neutral' }) => {
  const dims = sizeDimensions[size];
  const variant = avatarExpressions[expression] ?? avatarExpressions.neutral;
  const shoulderX = (200 - dims.shoulderWidth) / 2;
  const torsoX = (200 - dims.torsoWidth) / 2;
  const hipX = (200 - dims.hipWidth) / 2;

  return (
    <svg width={200} height={400} viewBox="0 0 200 400" xmlns="http://www.w3.org/2000/svg">
      {/* Base body layer */}
      <g id="base-body" fill="#f5c6a5">
        {/* Shoulders */}
        <rect x={shoulderX} y={80} width={dims.shoulderWidth} height={40} />
        {/* Torso */}
        <rect x={torsoX} y={120} width={dims.torsoWidth} height={80} />
        {/* Hips/waist */}
        <rect x={hipX} y={200} width={dims.hipWidth} height={60} />
        {/* Legs */}
        <rect x={70} y={260} width={25} height={100} />
        <rect x={105} y={260} width={25} height={100} />
      </g>

      {/* Face layer */}
      <g id="face">
        {/* Head shape */}
        <circle cx={100} cy={40} r={30} fill="#f5c6a5" />
        {/* Eyes */}
        <circle cx={90} cy={40} r={3} fill="#000" />
        <circle cx={110} cy={40} r={3} fill="#000" />
        {/* Brows */}
        <path d={variant.leftBrow} stroke="#000" strokeWidth={2} fill="none" />
        <path d={variant.rightBrow} stroke="#000" strokeWidth={2} fill="none" />
        {/* Nose */}
        <circle cx={100} cy={50} r={2} fill="#000" />
        {/* Mouth */}
        <path d={variant.mouth} stroke="#000" strokeWidth={2} fill="none" />
      </g>
    </svg>
  );
};

export default Avatar;
