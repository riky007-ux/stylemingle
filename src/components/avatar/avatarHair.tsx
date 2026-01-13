'use client';

import React from 'react';
import type { AvatarSize } from './Avatar';

export type AvatarHairKey = 'none' | 'short';

export const avatarHair: Record<AvatarHairKey, Record<AvatarSize, React.ReactNode>> = {
  none: {
    S: null,
    M: null,
    L: null,
    XL: null,
  },
  short: {
    S: (
      <g id="hair-short-s">
        <rect x={80} y={5} width={40} height={20} fill="#5d4037" rx={10} />
      </g>
    ),
    M: (
      <g id="hair-short-m">
        <rect x={75} y={5} width={50} height={25} fill="#5d4037" rx={10} />
      </g>
    ),
    L: (
      <g id="hair-short-l">
        <rect x={70} y={5} width={60} height={30} fill="#5d4037" rx={10} />
      </g>
    ),
    XL: (
      <g id="hair-short-xl">
        <rect x={65} y={5} width={70} height={35} fill="#5d4037" rx={10} />
      </g>
    ),
  },
};
