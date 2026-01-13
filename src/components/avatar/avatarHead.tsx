import React from 'react';
import type { ReactElement } from 'react';

export type AvatarHeadShape = 'oval' | 'round' | 'angular';
export type AvatarSize = 'S' | 'M' | 'L' | 'XL';

export const avatarHead: Record<AvatarHeadShape, Record<AvatarSize, ReactElement>> = {
  oval: {
    S: <ellipse cx={100} cy={50} rx={25} ry={28} fill="currentColor" />,
    M: <ellipse cx={100} cy={60} rx={30} ry={34} fill="currentColor" />,
    L: <ellipse cx={100} cy={70} rx={35} ry={40} fill="currentColor" />,
    XL: <ellipse cx={100} cy={80} rx={40} ry={46} fill="currentColor" />,
  },
  round: {
    S: <circle cx={100} cy={50} r={28} fill="currentColor" />,
    M: <circle cx={100} cy={60} r={32} fill="currentColor" />,
    L: <circle cx={100} cy={70} r={36} fill="currentColor" />,
    XL: <circle cx={100} cy={80} r={40} fill="currentColor" />,
  },
  angular: {
    S: <rect x={75} y={25} width={50} height={55} rx={12} fill="currentColor" />,
    M: <rect x={70} y={35} width={60} height={65} rx={14} fill="currentColor" />,
    L: <rect x={65} y={45} width={70} height={75} rx={16} fill="currentColor" />,
    XL: <rect x={60} y={55} width={80} height={85} rx={18} fill="currentColor" />,
  },
};
