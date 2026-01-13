"use client";

import React from "react";

export type AvatarSize = "S" | "M" | "L" | "XL";
export type AvatarExpression = "neutral" | "soft-smile";
export type AvatarHair = "none" | "short";

type AvatarProps = {
  size?: AvatarSize;
  expression?: AvatarExpression;
  hair?: AvatarHair;
};

const sizeMap = {
  S: { shoulder: 60, torso: 50, hip: 55 },
  M: { shoulder: 70, torso: 60, hip: 65 },
  L: { shoulder: 80, torso: 70, hip: 75 },
  XL: { shoulder: 90, torso: 80, hip: 85 },
};

const mouthByExpression: Record<AvatarExpression, JSX.Element> = {
  neutral: <path d="M90 78 Q100 80 110 78" stroke="#000" strokeWidth="2" fill="none" />,
  "soft-smile": <path d="M88 76 Q100 86 112 76" stroke="#000" strokeWidth="2" fill="none" />,
};

const hairByType: Record<AvatarHair, JSX.Element | null> = {
  none: null,
  short: (
    <path
      d="M70 35 Q100 10 130 35 Q120 25 100 28 Q80 25 70 35 Z"
      fill="#2F2F2F"
    />
  ),
};

export default function Avatar({
  size = "M",
  expression = "neutral",
  hair = "none",
}: AvatarProps) {
  const dims = sizeMap[size];

  return (
    <svg
      width="200"
      height="400"
      viewBox="0 0 200 400"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* BODY */}
      <g id="body" fill="#E8B89C">
        {/* Shoulders */}
        <rect x={100 - dims.shoulder / 2} y={90} width={dims.shoulder} height={30} />
        {/* Torso */}
        <rect x={100 - dims.torso / 2} y={120} width={dims.torso} height={90} />
        {/* Hips */}
        <rect x={100 - dims.hip / 2} y={210} width={dims.hip} height={40} />
        {/* Legs */}
        <rect x={85} y={250} width={20} height={120} />
        <rect x={115} y={250} width={20} height={120} />
      </g>

      {/* HEAD */}
      <g id="head" transform="translate(0,0)">
        <circle cx="100" cy="60" r="32" fill="#E8B89C" />

        {/* HAIR */}
        {hairByType[hair]}

        {/* EYES */}
        <circle cx="90" cy="58" r="4" fill="#000" />
        <circle cx="110" cy="58" r="4" fill="#000" />

        {/* MOUTH */}
        {mouthByExpression[expression]}
      </g>
    </svg>
  );
}
