"use client";

import { Avatar } from "@/components/avatar/Avatar";

export default function AvatarPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white p-8 md:p-12 rounded-xl shadow-md flex items-center justify-center">
        <Avatar
          size="M"
          expression="soft-smile"
          hair="short"
          skinTone="medium"
          outfit={{ top: "tshirt-basic", bottom: "jeans-basic" }}
        />
      </div>
    </div>
  );
}
