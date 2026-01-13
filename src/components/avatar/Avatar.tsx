"use client";

import React from "react";
import { avatarExpressions, AvatarExpression } from "./avatarExpressions";
import { avatarHair, AvatarHairKey } from "./avatarHair";
import { avatarTops, avatarBottoms, AvatarOutfit } from "./avatarClothing";
import { avatarHeadShapes, AvatarHeadShape } from "./avatarHeadShapes";
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
  L: { scale: 1.15 },
  XL: { scale: 1.3 },
};

export default function Avatar({
  size = "M",
  expression = "neutral",
  hair = "none",
  outfit,
  headShape = "oval",
  skinTone = "medium",
}: AvatarProps) {
  const scale = sizeMap[size].scale;

  const face = avatarExpressions[expression];
  const headElement = avatarHeadShapes[headShape];
  const skinColor = avatarSkinTones[skinTone];

  const hairElement = avatarHair[hair]?.[size] ?? null;
  const topElement = outfit?.top ? avatarTops[outfit.top]?.[size] : null;
  const bottomElement = outfit?.bottom
    ? avatarBottoms[outfit.bottom]?.[size]
    : null;

  return (
    <svg
      width={200}
      height={420}
      viewBox="0 0 200 420"
      xmlns="http://www.w3.org/2000/svg"
      style={{ transform: `scale(${scale})` }}
    >
      {/* BODY */}
      <g id="body" fill={skinColor}>
        <rect x={70} y={120} width={60} height={80} rx={12} />
        <rect x={60} y={200} width={80} height={90} rx={14} />
        <rect x={65} y={290} width={25} height={110} rx={10} />
        <rect x={110} y={290} width={25} height={110} rx={10} />
      </g>

      {/* CLOTHING */}
      <g id="clothing">
        {topElement}
        {bottomElement}
      </g>

      {/* HAIR */}
      <g id="hair">{hairElement}</g>

      {/* FACE */}
      <g id="face">
        {/* HEAD */}
        {React.cloneElement(
          headElement as React.ReactElement<any>,
          { fill: skinColor }
        )}

        {/* EYES */}
        <circle cx="85" cy="70" r="4" fill="#000" />
        <circle cx="115" cy="70" r="4" fill="#000" />

        {/* BROWS */}
        {face.leftBrow}
        {face.rightBrow}

        {/* NOSE */}
        <path
          d="M100 75 L96 88 L104 88 Z"
          fill="#C6865B"
          opacity={0.9}
        />

        {/* MOUTH */}
        {face.mouth}
      </g>
    </svg>
  );
}
