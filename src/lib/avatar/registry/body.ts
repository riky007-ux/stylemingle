import type { AvatarBodySize, AvatarGender } from "../types";

export const bodySizes: AvatarBodySize[] = ["S", "M", "L", "XL"];

type Transform = { torsoScaleX: number; torsoScaleY: number; hipScaleX: number; shoulderScaleX: number };

const transforms: Record<AvatarBodySize, Transform> = {
  S: { torsoScaleX: 0.92, torsoScaleY: 0.96, hipScaleX: 0.9, shoulderScaleX: 0.92 },
  M: { torsoScaleX: 1, torsoScaleY: 1, hipScaleX: 1, shoulderScaleX: 1 },
  L: { torsoScaleX: 1.08, torsoScaleY: 1.02, hipScaleX: 1.12, shoulderScaleX: 1.08 },
  XL: { torsoScaleX: 1.16, torsoScaleY: 1.05, hipScaleX: 1.2, shoulderScaleX: 1.14 },
};

export function BodyShape({ gender, size, fill, shade }: { gender: AvatarGender; size: AvatarBodySize; fill: string; shade: string }) {
  const t = transforms[size];
  const shoulderY = gender === "male" ? 144 : 148;
  const waistY = gender === "male" ? 198 : 194;
  const hipY = gender === "male" ? 230 : 226;

  return (
    <>
      <ellipse cx="128" cy={shoulderY} rx={36 * t.shoulderScaleX} ry="18" fill={shade} opacity={0.25} />
      <ellipse cx="128" cy={waistY} rx={26 * t.torsoScaleX} ry={30 * t.torsoScaleY} fill={fill} />
      <ellipse cx="128" cy={hipY} rx={30 * t.hipScaleX} ry="24" fill={fill} />
      <rect x={112} y={234} width="13" height="34" rx="6" fill={fill} />
      <rect x={131} y={234} width="13" height="34" rx="6" fill={fill} />
      <rect x={87} y={165} width={14 * t.shoulderScaleX} height="46" rx="7" fill={fill} />
      <rect x={155 - (14 * t.shoulderScaleX - 14)} y={165} width={14 * t.shoulderScaleX} height="46" rx="7" fill={fill} />
    </>
  );
}
