"use client";

import { useState } from "react";
import { getAvatarColor } from "@/lib/colors";
import { getPhotoUrl } from "@/lib/api";

interface ClientAvatarProps {
  name: string;
  photoUrl?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "w-8 h-8 text-sm",
  md: "w-10 h-10 text-base",
  lg: "w-16 h-16 text-2xl",
};

export function ClientAvatar({ name, photoUrl, size = "md" }: ClientAvatarProps) {
  const [error, setError] = useState(false);
  const cls = sizeClasses[size];

  if (photoUrl && !error) {
    return (
      <img
        src={getPhotoUrl(photoUrl)}
        alt={name}
        className={`${cls} rounded-full object-cover shrink-0`}
        onError={() => setError(true)}
      />
    );
  }

  return (
    <div className={`${cls} rounded-full flex items-center justify-center font-medium shrink-0 ${getAvatarColor(name)}`}>
      {name.charAt(0)}
    </div>
  );
}
