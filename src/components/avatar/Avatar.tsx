"use client";

import React from "react";
import { avatarExpressions, AvatarExpression } from "./avatarExpressions";
import { avatarHair, AvatarHairKey } from "./avatarHair";
import { avatarClothing, AvatarOutfit } from "./avatarClothing";
import { avatarHeadShapes, AvatarHeadShape } from "./avatarHead";
import { avatarSkinTones, AvatarSkinTone } from "./avatarSkinTones";

export type AvatarSize = "S" | "M" | "L" | "XL";

export type AvatarProps = {
  size?: AvatarSize;
  expression?: AvatarExpression;
  hair?: AvatarHairKey;
  headShape?: AvatarHeadShape;
  skinTone?: AvatarSkinTone;
  outfit?: AvatarOutfit;
};

const sizeScale: Record<AvatarSize, number> = {
  S: 0.85,
  M: 1,
  L: 1.15,
  XL: 1.3,
};

export default function Avatar({
  size = "M",
  expression = "neutral",
  hair = "none",
  headShape = "oval",
  skinTone = "medium",
  outfit,
}: AvatarProps) {
  const scale = sizeScale[size];
  const skinColor = avatarSkinTones[skinTone];
  const face = avatarExpressions[expression];
  const Hair = avatarHair[hair];
  const Head = avatarHeadShapes[headShape];
  const Clothing = outfit ? avatarClothing[outfit] : null;

  return (
    <svg
      width={200 * scale}
      height={400 * scale}
      viewBox="0 0 200 400"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* BODY */}
      <g id="body" fill={skinColor}>
        <rect x={70} y={80} width={60} height={100} rx={20} />
        <rect x={60} y={180} width={80} height={80} rx={30} />
        <rect x={70} y={260} width={20} height={110} />
        <rect x={110} y={260} width={20} height={110} />
      </g>

      {/* CLOTHING */}
      {Clothing && <Clothing size={size} />}

      {/* HEAD */}
      <g id="head">
        <Head fill={skinColor} />
      </g>

      {/* HAIR */}
      <g id="hair">
        <Hair size={size} />
      </g>

      {/* FACE */}
      <g id="face">
        {face.leftBrow}
        {face.rightBrow}
        {face.eyes}
        {face.nose}
        {face.mouth}
      </g>
    </svg>
  );
}
