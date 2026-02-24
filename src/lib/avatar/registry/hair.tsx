import type { RegistryOption } from "../types";

export const hairStyles: RegistryOption[] = [
  { key: "hair-wave", label: "Soft Wave" },
  { key: "hair-bob", label: "Classic Bob" },
  { key: "hair-curls", label: "Volume Curls" },
  { key: "hair-fade", label: "Taper Fade" },
  { key: "hair-quiff", label: "Quiff" },
  { key: "hair-crop", label: "Modern Crop" },
];

export function HairShape({ styleKey, fill }: { styleKey: string; fill: string }) {
  const common = { fill, stroke: "#1f2937", strokeWidth: 1.5 };
  switch (styleKey) {
    case "hair-bob":
      return <path d="M88 62c0-24 17-34 40-34s40 10 40 34v22H88V62Z" {...common} />;
    case "hair-curls":
      return <path d="M84 66c0-24 20-38 44-38s44 14 44 38c-8-8-13-8-18 0-6-8-12-8-18 0-7-8-13-8-20 0-6-8-12-8-18 0l-14 0Z" {...common} />;
    case "hair-fade":
      return <path d="M94 70c2-24 18-38 40-38 20 0 35 9 38 30-10-8-24-11-37-9-12 1-26 7-41 17Z" {...common} />;
    case "hair-quiff":
      return <path d="M92 72c0-27 17-41 43-41 16 0 32 7 40 24-11-3-20-2-26 3 1-8-7-13-21-13-15 0-26 8-36 27Z" {...common} />;
    case "hair-crop":
      return <path d="M92 71c4-21 18-33 40-33 21 0 34 11 38 29-18-7-44-8-78 4Z" {...common} />;
    case "hair-wave":
    default:
      return <path d="M90 68c0-25 18-38 42-38 22 0 39 11 40 34-8-6-19-8-32-5-17 4-30 2-40 9-4 3-7 3-10 0Z" {...common} />;
  }
}
