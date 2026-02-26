import type { RegistryOption } from "../types";

export const faceStyles: RegistryOption[] = [
  { key: "face-soft", label: "Face 1" },
  { key: "face-angular", label: "Face 2" },
  { key: "face-balanced", label: "Face 3" },
];

export function FaceShape({ styleKey, shade }: { styleKey: string; shade: string }) {
  if (styleKey === "face-angular") {
    return <path d="M108 84c0-20 10-32 20-32h0c10 0 20 12 20 32v18c0 12-8 26-20 26s-20-14-20-26V84Z" fill={shade} opacity={0.45} />;
  }

  if (styleKey === "face-balanced") {
    return <ellipse cx="128" cy="104" rx="20" ry="26" fill={shade} opacity={0.35} />;
  }

  return <ellipse cx="128" cy="106" rx="22" ry="27" fill={shade} opacity={0.32} />;
}

export function FaceDetails({ styleKey }: { styleKey: string }) {
  if (styleKey === "face-angular") {
    return (
      <>
        <path d="M111 96h12M133 96h12" stroke="#1f2937" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M128 99v9" stroke="#7c5a40" strokeWidth="1.2" strokeLinecap="round" />
      </>
    );
  }

  if (styleKey === "face-balanced") {
    return (
      <>
        <path d="M112 97h11M133 97h11" stroke="#1f2937" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M128 100v8" stroke="#7c5a40" strokeWidth="1.1" strokeLinecap="round" />
      </>
    );
  }

  return (
    <>
      <path d="M112 98h10M134 98h10" stroke="#1f2937" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M128 100v7" stroke="#7c5a40" strokeWidth="1" strokeLinecap="round" />
    </>
  );
}
