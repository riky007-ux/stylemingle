"use client";

import React from "react";
import { avatarExpressions, AvatarExpression } from "./avatarExpressions";
import { avatarHair, AvatarHairKey } from "./avatarHair";
import { avatarSkinTones, AvatarSkinTone } from "./avatarSkinTones";

export type AvatarOutfit = {
  top?: React.ReactNode;
  bottom?: React.ReactNode;
};

export type AvatarProps = {
  size?: "S" | "M" | "L" | "XL";
  expression?: AvatarExpression;
  hair?: AvatarHairKey;
  skinTone?: AvatarSkinTone;
  outfit?: AvatarOutfit;
};

const sizeScale = {
  S: 0.8,
  M: 1,
  L: 1.15,
  XL: 1.3,
};

export default function Avatar({
  size = "M",
  expression = "neutral",
  hair = "none",
  skinTone = "medium",
  outfit,
}: AvatarProps) {
  const scale = sizeScale[size];
  const face = avatarExpressions[expression];
  const skinColor = avatarSkinTones[skinTone];
  const Hair = avatarHair[hair];

  return (
    <svg
      width={200 * scale}
      height={420 * scale}
      viewBox="0 0 200 420"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* BODY */}
      <g fill={skinColor}>
        <rect x={70} y={80} width={60} height={100} rx={20} />
        <rect x={60} y={180} width={80} height={120} rx={20} />
        <rect x={70} y={300} width={20} height={100} />
        <rect x={110} y={300} width={20} height={100} />
      </g>

      {/* CLOTHING */}
      {outfit?.top}
      {outfit?.bottom}

      {/* HAIR */}
      {Hair && <Hair scale={scale} />}

      {/* FACE */}
      <g transform="translate(0,0)">
        <circle cx="100" cy="55" r="32" fill={skinColor} />
        {face.leftBrow}
        {face.rightBrow}
        <circle cx="90" cy="58" r="4" fill="#000" />
        <circle cx="110" cy="58" r="4" fill="#000" />
        {face.mouth}
      </g>
    </svg>
  );
}
