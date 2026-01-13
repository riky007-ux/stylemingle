"use client";

import Avatar from "@/components/avatar/Avatar";

export default function AvatarPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <Avatar
        size="M"
        expression="soft-smile"
        hair="short"
        skinTone="medium"
        outfit={{
          top: (
            <rect
              x={60}
              y={180}
              width={80}
              height={80}
              rx={20}
              fill="#4f7cff"
            />
          ),
          bottom: (
            <rect
              x={60}
              y={260}
              width={80}
              height={140}
              rx={20}
              fill="#2d2d2d"
            />
          ),
        }}
      />
    </div>
  );
}
