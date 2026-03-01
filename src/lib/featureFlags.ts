const TRUTHY_VALUES = new Set(["1", "true", "yes", "on"]);

export function isEnabled(value: string | undefined | null): boolean {
  if (typeof value !== "string") return false;
  return TRUTHY_VALUES.has(value.trim().toLowerCase());
}

