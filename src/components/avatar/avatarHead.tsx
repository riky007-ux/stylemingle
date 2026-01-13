import { ReactElement } from "react";

export type AvatarHeadShape = "oval" | "round" | "angular";

export const avatarHeadShapes: Record<AvatarHeadShape, ReactElement> = {
  oval: <circle cx={100} cy={60} r={32} />,
  round: <circle cx={100} cy={60} r={34} />,
  angular: <rect x={68} y={28} width={64} height={64} rx={10} />,
};
