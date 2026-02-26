export type AvatarGender = "male" | "female";
export type AvatarBodySize = "S" | "M" | "L" | "XL";

export type AvatarPreferences = {
  gender: AvatarGender;
  skinToneKey: string;
  hairStyleKey: string;
  hairColorKey: string;
  faceStyleKey: string;
  bodySize: AvatarBodySize;
};

export type RegistryTone = {
  key: string;
  label: string;
  fill: string;
  shade: string;
};

export type RegistryOption = {
  key: string;
  label: string;
};

export const DEFAULT_AVATAR_PREFERENCES: AvatarPreferences = {
  gender: "female",
  skinToneKey: "tone4",
  hairStyleKey: "hair-wave",
  hairColorKey: "espresso",
  faceStyleKey: "face-soft",
  bodySize: "M",
};

export const HAIR_COLORS: Array<{ key: string; label: string; fill: string }> = [
  { key: "espresso", label: "Espresso", fill: "#2B1B12" },
  { key: "black", label: "Black", fill: "#151515" },
  { key: "chestnut", label: "Chestnut", fill: "#5A3A22" },
  { key: "auburn", label: "Auburn", fill: "#7C3F28" },
  { key: "ash", label: "Ash Brown", fill: "#4A3F3B" },
];
