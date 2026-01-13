"use client";

import React from 'react';

export type AvatarSize = 'S' | 'M' | 'L' | 'XL';

interface AvatarProps {
  size?: AvatarSize;
}

const sizeDimensions: Record<AvatarSize, { torsoWidth: number; hipWidth: number; shoulderWidth: number }> = {
  S: { torsoWidth: 40, hipWidth: 40, shoulderWidth: 40 },
  M: { torsoWidth: 50, hipWidth: 50, shoulderWidth: 50 },
  L: { torsoWidth: 60, hipWidth: 60, shoulderWidth: 60 },
  XL: { torsoWidth: 70, hipWidth: 70, shoulderWidth: 70 },
};

const Avatar: React.FC<AvatarProps> = ({ size = 'M' }) => {
  const dims = sizeDimensions[size];

  const shoulderX = (200 - dims.shoulderWidth) / 2;
  const torsoX = (200 - dims.torsoWidth) / 2;
  const hipX = (200 - dims.hipWidth) / 2;

  return (
    <svg width={200} height={400} viewBox="0 0 200 400">
      {/* Base body layer */}
      <g id="base-body" fill="#f5c6a5">
        {/* Head */}
        <circle cx={100} cy={50} r={30} />
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
      {/* Bottoms layer */}
      <g id="bottoms"></g>
      {/* Tops layer */}
      <g id="tops"></g>
      {/* Outerwear layer */}
      <g id="outerwear"></g>
      {/* Accessories layer */}
      <g id="accessories"></g>
    </svg>
  );
};

export default Avatar;
