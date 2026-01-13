"use client";

import React from "react";
import { avatarExpressions, AvatarExpression } from "./avatarExpressions";
import { avatarHair, AvatarHairKey } from "./avatarHair";
import { avatarSkinTones, AvatarSkinTone } from "./avatarSkinTones";
import {
  avatarTops,
  avatarBottoms,
  AvatarTopKey,
  AvatarBottomKey,
} from "./avatarClothing";

export type AvatarSize = "S" | "M" | "L" | "XL";

export type AvatarOutfit = {
  top?: AvatarTopKey;
  bottom?: AvatarBottomKey;
};

export type AvatarProps = {
  size?: AvatarSize;
  expression?: AvatarExpression;
  hair?: AvatarHairKey;
  skinTone?: AvatarSkinTone;
  outfit?: AvatarOutfit;
};

const sizeScale: Record<AvatarSize, number> = {
  S: 0.8,
  M: 1,
  L: 1.15,
  XL: 1.3,
};

export const Avatar: React.FC<AvatarProps> = ({
  size = "M",
  expression,
  hair,
  skinTone,
  outfit,
}) => {
  const scale = sizeScale[size] ?? 1;
  const skin = avatarSkinTones[skinTone ?? "default"];
  const topElement = outfit?.top ? avatarTops[outfit.top] : null;
  const bottomElement = outfit?.bottom ? avatarBottoms[outfit.bottom] : null;
  const hairElement = hair ? avatarHair[hair] : null;
  const expressionElement = expression ? avatarExpressions[expression] : null;

  return (
    <svg
      width={200 * scale}
      height={350 * scale}
      viewBox="0 0 200 350"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform={`scale(${scale})`}>
        {/* legs */}
        <rect x={75} y={190} width={25} height={75} rx={6} fill={skin} />
        <rect x={100} y={190} width={25} height={75} rx={6} fill={skin} />

        {/* pants overlay legs */}
        {bottomElement}

        {/* torso */}
        <rect x={60} y={110} width={80} height={90} rx={20} fill={skin} />

        {/* top overlay torso but under head */}
        {topElement}

        {/* neck */}
        <rect x={90} y={90} width={20} height={25} rx={6} fill={skin} />

        {/* head */}
        <circle cx={100} cy={60} r={30} fill={skin} />

        {/* hair */}
        {hairElement}

        {/* facial features */}
        {expressionElement}
      </g>
    </svg>
  );
};
