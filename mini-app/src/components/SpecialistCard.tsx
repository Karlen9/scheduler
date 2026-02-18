'use client';

import { useState } from 'react';
import { Share2, Phone, MessageCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getAvatarColor } from '@/lib/colors';
import { getPhotoUrl } from '@/lib/api';

interface SpecialistCardProps {
  name: string;
  specialization: string;
  photoUrl?: string;
  phone?: string;
  telegram?: string;
  botUsername?: string;
  servicesCount?: number;
  onServices?: () => void;
  onShare?: () => void;
}

export function SpecialistCard({
  name,
  specialization,
  photoUrl,
  phone,
  telegram,
  botUsername,
  servicesCount,
  onServices,
  onShare,
}: SpecialistCardProps) {
  const t = useTranslations('HomePage');
  const [photoError, setPhotoError] = useState(false);

  const handleMessage = () => {
    if (telegram) {
      const handle = telegram.replace('@', '');
      window.open(`https://t.me/${handle}`, '_blank');
    } else if (botUsername) {
      window.open(`https://t.me/${botUsername}`, '_blank');
    }
  };
  return (
    <div className="bg-card rounded-xl p-4">
      {/* Profile Header */}
      <div className="mb-4 flex gap-4">
        <div className="bg-border relative h-[127px] w-[127px] flex-shrink-0 overflow-hidden rounded-full">
          {photoUrl && !photoError ? (
            <img
              src={getPhotoUrl(photoUrl)}
              alt={name}
              className="h-full w-full object-cover"
              onError={() => setPhotoError(true)}
            />
          ) : (
            <div
              className={`flex h-full w-full items-center justify-center text-4xl ${getAvatarColor(name)}`}
            >
              {name.charAt(0)}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="text-foreground mb-2 text-xl leading-tight font-bold">{name}</h2>
          {specialization && (
            <p className="text-foreground mb-3 text-sm leading-snug font-medium">
              {specialization}
            </p>
          )}

          {/* Contact Info */}
          {(phone || telegram) && (
            <div className="space-y-1.5">
              {phone && (
                <div className="flex items-center gap-2">
                  <Phone className="text-muted-foreground h-3 w-3" />
                  <p className="text-muted-foreground text-xs">{phone}</p>
                </div>
              )}
              {telegram && (
                <div className="flex items-center gap-2">
                  <MessageCircle className="text-muted-foreground h-3 w-3" />
                  <p className="text-muted-foreground text-xs">{telegram}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      {servicesCount != null && servicesCount > 0 && (
        <div className="bg-background mb-4 rounded-xl p-4">
          <div className="text-center">
            <p className="text-foreground text-lg font-bold">{servicesCount}</p>
            <p className="text-muted-foreground text-xs">{t('servicesTitle').replace(':', '')}</p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        {(telegram || botUsername) && (
          <button
            onClick={handleMessage}
            className="bg-brand flex-1 rounded-[28px] px-4 py-3 text-sm font-medium text-white transition-opacity active:opacity-80"
          >
            {t('messageButton')}
          </button>
        )}
        <button
          onClick={onServices}
          className="bg-surface-hover border-surface-border text-muted-foreground flex-1 rounded-[28px] border px-4 py-3 text-sm font-medium transition-opacity active:opacity-80"
        >
          {t('servicesButton')}
        </button>
        <button
          onClick={onShare}
          className="bg-surface-hover border-surface-border flex h-12 w-12 items-center justify-center rounded-[28px] border transition-opacity active:opacity-80"
        >
          <Share2 className="text-muted-foreground h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
