"use client";

import { Share2, Phone, MessageCircle } from "lucide-react";
import Image from "next/image";

interface TrainerCardProps {
  name: string;
  specialization: string;
  rating?: number;
  bio: string;
  photoUrl?: string;
  phone?: string;
  telegram?: string;
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
  onServices,
  onShare,
}: TrainerCardProps) {
  const handleMessage = () => {
    if (!telegram) return; 
    const username = telegram.replace("@", "");
    window.open(`https://t.me/${username}`, "_blank");
  };
  return (
    <div className="bg-(--app-surface) rounded-xl p-4">
      {/* Profile Header */}
      <div className="flex gap-4 mb-4">
        <div className="relative w-[127px] h-[127px] rounded-full overflow-hidden flex-shrink-0 bg-[var(--app-divider)]">
          {photoUrl ? (
            <Image src={photoUrl} alt={name} fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl text-[var(--app-subtext)]">
              {name.charAt(0)}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-[var(--app-text)] mb-2 leading-tight">
            {name}
          </h2>
          <p className="text-sm font-medium text-[var(--app-text)] mb-3 leading-snug">
            {specialization}
          </p>

          {/* Contact Info */}
          {(phone || telegram) && (
            <div className="space-y-1.5">
              {phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3 h-3 text-[var(--app-subtext)]" />
                  <p className="text-xs text-[var(--app-subtext)]">{phone}</p>
                </div>
              )}
              {telegram && (
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-3 h-3 text-[var(--app-subtext)]" />
                  <p className="text-xs text-[var(--app-subtext)]">{telegram}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bio */}
      <p className="text-sm text-[var(--app-subtext)] leading-relaxed mb-4">
        {bio}
      </p>

      {/* Action Buttons */}
      <div className="flex gap-2">
        {telegram && (
          <button
            onClick={handleMessage}
            className="flex-1 py-3 px-4 rounded-[28px] bg-[#5984d8] text-white text-sm font-medium transition-opacity active:opacity-80"
          >
            Написать
          </button>
        )}
        <button
          onClick={onServices}
          className="flex-1 py-3 px-4 rounded-[28px] bg-white border border-[#c9c9c9] text-[#8e8e8e] text-sm font-medium transition-opacity active:opacity-80"
        >
          Услуги и цены
        </button>
        <button
          onClick={onShare}
          className="w-12 h-12 rounded-[28px] bg-white border border-[#c9c9c9] flex items-center justify-center transition-opacity active:opacity-80"
        >
          <Share2 className="w-4 h-4 text-[#8e8e8e]" />
        </button>
      </div>
    </div>
  );
}
