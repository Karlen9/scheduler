"use client";

import { useState } from "react";
import { Share2, Phone, MessageCircle } from "lucide-react";
import { getAvatarColor } from "@/lib/colors";
import { getPhotoUrl } from "@/lib/api";

interface TrainerCardProps {
  name: string;
  specialization: string;
  rating?: number;
  bio: string;
  photoUrl?: string;
  phone?: string;
  telegram?: string;
  botUsername?: string;
  onServices?: () => void;
  onShare?: () => void;
}

export function TrainerCard({
  name,
  specialization,
  bio,
  photoUrl,
  phone,
  telegram,
  botUsername,
  onServices,
  onShare,
}: TrainerCardProps) {
  const [photoError, setPhotoError] = useState(false);
  const handleMessage = () => {
    if (telegram) {
      const handle = telegram.replace("@", "");
      window.open(`https://t.me/${handle}`, "_blank");
    } else if (botUsername) {
      window.open(`https://t.me/${botUsername}`, "_blank");
    }
  };
  return (
    <div className="bg-card rounded-xl p-4">
      {/* Profile Header */}
      <div className="flex gap-4 mb-4">
        <div className="relative w-[127px] h-[127px] rounded-full overflow-hidden flex-shrink-0 bg-border">
          {photoUrl && !photoError ? (
            <img
              src={getPhotoUrl(photoUrl)}
              alt={name}
              className="w-full h-full object-cover"
              onError={() => setPhotoError(true)}
            />
          ) : (
            <div className={`w-full h-full flex items-center justify-center text-4xl ${getAvatarColor(name)}`}>
              {name.charAt(0)}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-foreground mb-2 leading-tight">
            {name}
          </h2>
          <p className="text-sm font-medium text-foreground mb-3 leading-snug">
            {specialization}
          </p>

          {/* Contact Info */}
          {(phone || telegram) && (
            <div className="space-y-1.5">
              {phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3 h-3 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">{phone}</p>
                </div>
              )}
              {telegram && (
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-3 h-3 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">{telegram}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bio */}
      <p className="text-sm text-muted-foreground leading-relaxed mb-4">
        {bio}
      </p>

      {/* Action Buttons */}
      <div className="flex gap-2">
        {(telegram || botUsername) && (
          <button
            onClick={handleMessage}
            className="flex-1 py-3 px-4 rounded-[28px] bg-brand text-white text-sm font-medium transition-opacity active:opacity-80"
          >
            Написать
          </button>
        )}
        <button
          onClick={onServices}
          className="flex-1 py-3 px-4 rounded-[28px] bg-surface-hover border border-surface-border text-muted-foreground text-sm font-medium transition-opacity active:opacity-80"
        >
          Услуги и цены
        </button>
        <button
          onClick={onShare}
          className="w-12 h-12 rounded-[28px] bg-surface-hover border border-surface-border flex items-center justify-center transition-opacity active:opacity-80"
        >
          <Share2 className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
