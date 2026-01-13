import { ReactElement } from "react";

export type AvatarTopKey = "tshirt-basic";
export type AvatarBottomKey = "jeans-basic";

export type AvatarOutfit = {
  top?: AvatarTopKey;
  bottom?: AvatarBottomKey;
};

export const avatarTops: Record<AvatarTopKey, ReactElement> = {
  "tshirt-basic": (
    <>
      <defs>
        <linearGradient id="tshirt-basic-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
        <linearGradient id="tshirt-basic-highlight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g id="top">
        <rect x={65} y={120} width={70} height={75} rx={14} fill="url(#tshirt-basic-fill)" />
        <rect x={65} y={120} width={70} height={75} rx={14} fill="url(#tshirt-basic-highlight)" />
        <rect x={65} y={120} width={70} height={75} rx={14} fill="none" stroke="#000" strokeOpacity={0.04} />
      </g>
    </>
  ),
};

export const avatarBottoms: Record<AvatarBottomKey, ReactElement> = {
  "jeans-basic": (
    <>
      <defs>
        <linearGradient id="jeans-basic-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1f2937" />
          <stop offset="100%" stopColor="#111827" />
        </linearGradient>
        <linearGradient id="jeans-basic-highlight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g id="bottom">
        {/* left pant leg */}
        <rect x={75} y={190} width={20} height={75} rx={6} fill="url(#jeans-basic-fill)" />
        <rect x={75} y={190} width={20} height={75} rx={6} fill="url(#jeans-basic-highlight)" />
        <rect x={75} y={190} width={20} height={75} rx={6} fill="none" stroke="#000" strokeOpacity={0.04} />
        {/* right pant leg */}
        <rect x={105} y={190} width={20} height={75} rx={6} fill="url(#jeans-basic-fill)" />
        <rect x={105} y={190} width={20} height={75} rx={6} fill="url(#jeans-basic-highlight)" />
        <rect x={105} y={190} width={20} height={75} rx={6} fill="none" stroke="#000" strokeOpacity={0.04} />
      </g>
    </>
  ),
};
