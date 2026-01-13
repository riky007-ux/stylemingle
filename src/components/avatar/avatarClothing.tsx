import { ReactElement } from "react";

export type AvatarTopKey = "tshirt-basic";
export type AvatarBottomKey = "jeans-basic";

export type AvatarOutfit = {
  top?: AvatarTopKey;
  bottom?: AvatarBottomKey;
};

export const avatarTops: Record<AvatarTopKey, ReactElement> = {
  "tshirt-basic": (
    <g id="top">
      <rect x={70} y={120} width={60} height={70} fill="#3b82f6" rx={8} />
    </g>
  ),
};

export const avatarBottoms: Record<AvatarBottomKey, ReactElement> = {
  "jeans-basic": (
    <g id="bottom">
      <rect x={75} y={190} width={20} height={70} fill="#1f2937" />
      <rect x={105} y={190} width={20} height={70} fill="#1f2937" />
    </g>
  ),
};
