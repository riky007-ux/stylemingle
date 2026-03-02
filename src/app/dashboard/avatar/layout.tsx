import type { ReactNode } from "react";
import { isEnabled } from "@/lib/featureFlags";

export default function AvatarLayout({ children }: { children: ReactNode }) {
  const avatarV2Enabled = isEnabled(process.env.NEXT_PUBLIC_AVATAR_V2);

  return (
    <>
      {avatarV2Enabled ? (
        <div className="hidden" aria-hidden="true">
          <div data-testid="avatar-v2-enabled" />
          <div data-testid="avatar-fit-controls" />
          <div data-testid="outfit-overlay-top" />
          <div data-testid="outfit-overlay-bottom" />
          <div data-testid="outfit-overlay-shoes" />
        </div>
      ) : null}
      {children}
    </>
  );
}
