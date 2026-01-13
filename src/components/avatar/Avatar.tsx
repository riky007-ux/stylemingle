"use client";
import React from "react";
import { avatarExpressions, AvatarExpression } from "./avatarExpressions";
import { avatarHair, AvatarHairKey } from "./avatarHair";
import { avatarSkinTones, AvatarSkinTone } from "./avatarSkinTones";
import { avatarTops, avatarBottoms, AvatarTopKey, AvatarBottomKey } from "./avatarClothing";

export type AvatarSize = "S" | "M" | "L" | "XL";

export type AvatarOutfit = {
  top: AvatarTopKey;
  bottom: AvatarBottomKey;
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

export default function Avatar({
  size = "M",
  expression = "neutral",
  hair = "none",
  skinTone = "light",
  outfit = { top: "tshirt-basic", bottom: "jeans-basic" },
}: AvatarProps) {
  const scale = sizeScale[size];
  const hairElement = avatarHair[hair]?.[size] ?? null;
  const face = avatarExpressions[expression];
  const skinColor = avatarSkinTones[skinTone];
  const topElement = outfit?.top ? avatarTops[outfit.top] : null;
  const bottomElement = outfit?.bottom ? avatarBottoms[outfit.bottom] : null;

  return (
    <svg
      width={200 * scale}
      height={420 * scale}
      viewBox="0 200 420"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* BODY */}
      <g fill={skinColor}>
        <rect x={70} y={80} width={60} height={100} rx={20} />
        <rect x={68} y={180} width={80} height={120} rx={20} />
        <rect x={78} y={300} width={20} height={100} />
        <rect x={110} y={300} width={20} height={100} />
      </g>

      {/* CLOTHING */}
      {topElement}
      {bottomElement}

      {/* HAIR */}
      {hairElement}

      {/* FACE */}
      <g transform="translate(0,0)">
        <circle cx="100" cy="55" r="32" fill={skinColor} />
        {face.leftBrow}
        {face.rightBrow}
        <circle cx="90" cy="59" r="4" fill="#000" />
        <circle cx="110" cy="59" r="4" fill="#000" />
        {face.mouth}
      </g>
    </svg>
  );
}
