"use client";

import React from "react";
import { avatarExpressions, AvatarExpression } from "./avatarExpressions";
import { avatarHair, AvatarHairKey } from "./avatarHair";
import { avatarTops, avatarBottoms, AvatarOutfit } from "./avatarClothing";
import { avatarHeadShapes, AvatarHeadShape } from "./avatarHead";
import { avatarSkinTones, AvatarSkinTone } from "./avatarSkinTones";

type AvatarSize = "S" | "M" | "L" | "XL";

type AvatarProps = {
  size?: AvatarSize;
  expression?: AvatarExpression;
  hair?: AvatarHairKey;
  outfit?: AvatarOutfit;
  headShape?: AvatarHeadShape;
  skinTone?: AvatarSkinTone;
};

const sizeMap = {
  S: { scale: 0.85 },
  M: { scale: 1 },
  L: { scale: 1.1 },
  XL: { scale: 1.2 },
};

export default function Avatar({
  size = "M",
  expression = "neutral",
  hair = "none",
  outfit,
  headShape = "oval",
  skinTone = "medium",
}: AvatarProps) {
  const { scale } = sizeMap[size];
  const face = avatarExpressions[expression];
  const skinColor = avatarSkinTones[skinTone];
  const headElement = avatarHeadShapes[headShape];
  const hairElement = avatarHair[hair];

  return (
    <svg
      width={200}
      height={400}
      viewBox="0 0 200 400"
      style={{ transform: `scale(${scale})` }}
    >
      {/* Body */}
      <g fill={skinColor}>
        <rect x={80} y={100} width={40} height={120} rx={10} />
        <rect x={70} y={220} width={20} height={120} />
        <rect x={110} y={220} width={20} height={120} />
      </g>

      {/* Clothing */}
      {outfit?.top && avatarTops[outfit.top]}
      {outfit?.bottom && avatarBottoms[outfit.bottom]}

      {/* Hair */}
      {hairElement}

      {/* Face */}
      <g id="face">
        {React.cloneElement(headElement as any, { fill: skinColor })}
        {face.leftBrow}
        {face.rightBrow}
        {face.mouth}
      </g>
    </svg>
  );
}
