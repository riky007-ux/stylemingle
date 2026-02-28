import { skinTones } from "./registry/skinTones";
import { HairShape } from "./registry/hair";
import { FaceDetails, FaceShape } from "./registry/faces";
import { BodyShape } from "./registry/body";
import { DEFAULT_AVATAR_PREFERENCES, HAIR_COLORS, type AvatarPreferences } from "./types";

export function AvatarV2SVG({ preferences }: { preferences?: AvatarPreferences }) {
  const current = preferences ?? DEFAULT_AVATAR_PREFERENCES;
  const tone = skinTones.find((t) => t.key === current.skinToneKey) ?? skinTones[3];
  const hairColor = HAIR_COLORS.find((c) => c.key === current.hairColorKey) ?? HAIR_COLORS[0];

  return (
    <svg viewBox="0 0 256 320" className="w-full h-full rounded-2xl bg-gradient-to-b from-[#f8fafc] via-[#eef2ff] to-[#e2e8f0]" role="img" aria-label="Premium avatar preview">
      <defs>
        <linearGradient id="smSkinGlow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tone.fill} />
          <stop offset="100%" stopColor={tone.shade} />
        </linearGradient>
      </defs>

      <ellipse cx="128" cy="285" rx="56" ry="12" fill="#94a3b8" opacity="0.2" />
      <path d="M70 244c0-39 26-69 58-69s58 30 58 69" fill="#e2e8f0" opacity="0.7" />
      <BodyShape gender={current.gender} size={current.bodySize} fill="url(#smSkinGlow)" shade={tone.shade} />
      <path d="M81 184c31 15 63 15 94 0v65H81v-65Z" fill="#0f172a" opacity="0.92" />
      <circle cx="128" cy="92" r="38" fill="url(#smSkinGlow)" />
      <FaceShape styleKey={current.faceStyleKey} shade={tone.shade} />
      <circle cx="115" cy="102" r="2.4" fill="#111827" />
      <circle cx="141" cy="102" r="2.4" fill="#111827" />
      <path d="M118 120c5 6 15 6 20 0" stroke="#7c4a32" strokeWidth="2" strokeLinecap="round" fill="none" />
      <FaceDetails styleKey={current.faceStyleKey} />
      <HairShape styleKey={current.hairStyleKey} fill={hairColor.fill} />
      <path d="M90 82c7-27 70-31 78 2" fill="none" stroke="#0f172a" strokeOpacity="0.08" strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}
