import React, { ReactElement } from 'react';

export type AvatarExpression = 'neutral' | 'soft-smile';

export const avatarExpressions: Record<AvatarExpression, { mouth: ReactElement; leftBrow: ReactElement; rightBrow: ReactElement }> = {
  neutral: {
    mouth: <path d="M90 65 Q100 67 110 65" stroke="black" strokeWidth={2} fill="none" />, 
    leftBrow: <path d="M84 38 Q98 36 96 38" stroke="black" strokeWidth={2} fill="none" />, 
    rightBrow: <path d="M104 38 Q118 36 116 37" stroke="black" strokeWidth={2} fill="none" />,
  },
  'soft-smile': {
    mouth: <path d="M90 65 Q100 70 110 65" stroke="black" strokeWidth={2} fill="none" />, 
    leftBrow: <path d="M84 37 Q93 35 96 37" stroke="black" strokeWidth={2} fill="none" />, 
    rightBrow: <path d="M104 37 Q113 35 116 37" stroke="black" strokeWidth={2} fill="none" />,
  },
};
