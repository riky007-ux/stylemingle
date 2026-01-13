'use client';

import React from 'react';
import type { AvatarSize } from './Avatar';

export const avatarTops: Record<string, Record<AvatarSize, React.ReactNode>> = {
  'tshirt-basic': {
    S: <rect x={80} y={80} width={40} height={120} fill="#6EC1E4" />,
    M: <rect x={75} y={80} width={50} height={120} fill="#6EC1E4" />,
    L: <rect x={70} y={80} width={60} height={120} fill="#6EC1E4" />,
    XL: <rect x={65} y={80} width={70} height={120} fill="#6EC1E4" />,
  },
};

export const avatarBottoms: Record<string, Record<AvatarSize, React.ReactNode>> = {
  'jeans-basic': {
    S: <rect x={80} y={203} width={40} height={160} fill="#3465A4" />,
    M: <rect x={75} y={203} width={50} height={160} fill="#3465A4" />,
    L: <rect x={70} y={203} width={60} height={160} fill="#3465A4" />,
    XL: <rect x={65} y={203} width={70} height={160} fill="#3465A4" />,
  },
};
