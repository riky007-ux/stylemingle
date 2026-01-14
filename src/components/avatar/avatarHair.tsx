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
        <rect x={80} y={0} width={40} height={25} fill="#5a3e34" rx={10} />
      </g>
    ),
    M: (
      <g id="hair-short-m">
        <rect x={75} y={0} width={50} height={30} fill="#5a3e34" rx={10} />
      </g>
    ),
    L: (
      <g id="hair-short-l">
        <rect x={70} y={0} width={60} height={35} fill="#5a3e34" rx={10} />
      </g>
    ),
    XL: (
      <g id="hair-short-xl">
        <rect x={65} y={0} width={70} height={40} fill="#5a3e34" rx={10} />
      </g>
    ),
  },
};
