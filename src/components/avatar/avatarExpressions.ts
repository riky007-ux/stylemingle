export type AvatarExpression = 'neutral' | 'soft-smile';

export const avatarExpressions: Record<AvatarExpression, { mouth: string; leftBrow: string; rightBrow: string }> = {
  neutral: {
    mouth: 'M90 65 Q100 67 110 65',
    leftBrow: 'M84 38 Q98 36 96 38',
    rightBrow: 'M104 38 Q118 36 116 37',
  },
  'soft-smile': {
    mouth: 'M90 65 Q100 70 110 65',
    leftBrow: 'M84 37 Q93 35 96 37',
    rightBrow: 'M104 37 Q113 35 116 37',
  },
};
