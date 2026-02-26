import { skinTones } from "./registry/skinTones";
import { HairShape } from "./registry/hair";
import { FaceDetails, FaceShape } from "./registry/faces";
import { BodyShape } from "./registry/body";
import { DEFAULT_AVATAR_PREFERENCES, HAIR_COLORS, type AvatarPreferences } from "./types";

export function AvatarSVG({ preferences }: { preferences?: AvatarPreferences }) {
  const current = preferences ?? DEFAULT_AVATAR_PREFERENCES;
  const tone = skinTones.find((t) => t.key === current.skinToneKey) ?? skinTones[3];
  const hairColor = HAIR_COLORS.find((c) => c.key === current.hairColorKey) ?? HAIR_COLORS[0];

  return (
    <svg viewBox="0 0 256 320" className="w-full h-full rounded-2xl bg-gradient-to-b from-slate-100 to-slate-200" role="img" aria-label="Avatar preview">
      <circle cx="128" cy="90" r="34" fill={tone.fill} />
      <FaceShape styleKey={current.faceStyleKey} shade={tone.shade} />
      <circle cx="116" cy="102" r="2.2" fill="#111827" />
      <circle cx="140" cy="102" r="2.2" fill="#111827" />
      <path d="M119 118c5 6 13 6 18 0" stroke="#6b4b35" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <FaceDetails styleKey={current.faceStyleKey} />
      <HairShape styleKey={current.hairStyleKey} fill={hairColor.fill} />
      <BodyShape gender={current.gender} size={current.bodySize} fill={tone.fill} shade={tone.shade} />
      <path d="M95 178c21 8 45 8 66 0v56H95v-56Z" fill="#1d4ed8" opacity="0.92" />
    </svg>
  );
}
