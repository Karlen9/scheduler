'use client';

import { useState, useEffect, useRef } from 'react';
import { Camera } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { setLocale } from '@/actions/locale';
import { ActivityBackButton } from '@/components/ActivityBackButton';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ServiceSelector } from '@/components/ServiceSelector';
import { PhotoEditor } from '@/components/PhotoEditor';
import { api, getPhotoUrl } from '@/lib/api';
import { getAvatarColor } from '@/lib/colors';
import { ThemeSelector } from '@/components/ThemeSelector';
import { LanguageSelector } from '@/components/LanguageSelector';
import { useProfile, useSessionTypes } from '@/hooks/queries';
import { invalidateProfile } from '@/hooks/mutations';

export default function ClientProfilePage() {
  const t = useTranslations('ProfilePage');
  const tc = useTranslations('Common');
  const te = useTranslations('Errors');
  const ts = useTranslations('Success');
  const tl = useTranslations('LanguageSelector');
  const locale = useLocale();
  const router = useRouter();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: services, isLoading: servicesLoading } = useSessionTypes();
  const loading = profileLoading || servicesLoading;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoError, setPhotoError] = useState(false);
  const [preferredDuration, setPreferredDuration] = useState<number>(60);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editorImage, setEditorImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [notifyBookingStatus, setNotifyBookingStatus] = useState(true);
  const [notifyReminders, setNotifyReminders] = useState(true);
  const [notifyDaysOff, setNotifyDaysOff] = useState(false);
  const [notifyCancellations, setNotifyCancellations] = useState(true);

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setPhone(profile.phone || '');
      setPhotoUrl(profile.photoUrl || '');
      setPreferredDuration(profile.preferredDuration || services[0]?.durationMinutes || 60);
      setNotifyBookingStatus(profile.notifyBookingStatus ?? true);
      setNotifyReminders(profile.notifyReminders ?? true);
      setNotifyDaysOff(profile.notifyDaysOff ?? false);
      setNotifyCancellations(profile.notifyCancellations ?? true);
    }
  }, [profile, services]);

  // Cross-device language sync
  const syncedRef = useRef(false);
  useEffect(() => {
    if (profile?.language && profile.language !== locale && !syncedRef.current) {
      syncedRef.current = true;
      setLocale(profile.language).then(() => router.refresh());
    }
  }, [profile?.language, locale, router]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setEditorImage(url);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleEditorConfirm = async (blob: Blob) => {
    setEditorImage(null);
    setIsUploading(true);
    try {
      const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
      const result = await api.uploadPhoto(file);
      setPhotoUrl(result.fileId);
      setPhotoError(false);
      invalidateProfile();
      toast.success(ts('photoUpdated'));
    } catch (err) {
      console.error('Failed to upload photo:', err);
      toast.error(te('photoUploadFailed'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.updateProfile({ name, phone, preferredDuration });
      invalidateProfile();
      toast.success(ts('profileSaved'));
    } catch (err) {
      console.error('Failed to save profile:', err);
      toast.error(te('saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleNotification = async (
    key: 'notifyBookingStatus' | 'notifyReminders' | 'notifyDaysOff' | 'notifyCancellations',
    value: boolean,
  ) => {
    const setters = {
      notifyBookingStatus: setNotifyBookingStatus,
      notifyReminders: setNotifyReminders,
      notifyDaysOff: setNotifyDaysOff,
      notifyCancellations: setNotifyCancellations,
    };
    setters[key](value);
    try {
      await api.updateNotificationPrefs({ [key]: value });
    } catch {
      setters[key](!value);
      toast.error(te('saveSettingsFailed'));
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6 p-4">
        <div className="flex justify-center pt-2">
          <div className="bg-card h-24 w-24 rounded-full" />
        </div>
        <div className="space-y-4">
          <div>
            <div className="bg-card mb-2 h-4 w-10 rounded" />
            <div className="bg-card h-12 rounded-lg" />
          </div>
          <div>
            <div className="bg-card mb-2 h-4 w-16 rounded" />
            <div className="bg-card h-12 rounded-lg" />
          </div>
        </div>
        <div className="bg-card h-12 rounded-lg" />
      </div>
    );
  }

  return (
    <div>
      <ActivityBackButton href="/" />
      <div className="space-y-6 p-4">
        {/* Avatar */}
        <div className="flex justify-center pt-2">
          <div className="relative cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            {photoUrl && !photoError ? (
              <img
                src={getPhotoUrl(photoUrl)}
                alt={name}
                className="h-24 w-24 rounded-full object-cover"
                onError={() => setPhotoError(true)}
              />
            ) : (
              <div
                className={`flex h-24 w-24 items-center justify-center rounded-full text-3xl ${name ? getAvatarColor(name) : 'bg-card text-muted-foreground'}`}
              >
                {name.charAt(0) || '?'}
              </div>
            )}
            <div className="bg-brand absolute right-0 bottom-0 flex h-8 w-8 items-center justify-center rounded-full shadow-lg">
              {isUploading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Camera className="h-4 w-4 text-white" />
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="text-muted-foreground mb-1 block text-sm">{t('nameLabel')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              className="bg-card text-foreground focus:ring-brand w-full rounded-lg px-4 py-3 outline-none focus:ring-2"
            />
          </div>

          <div>
            <label className="text-muted-foreground mb-1 block text-sm">{t('phoneLabel')}</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={20}
              placeholder={t('phonePlaceholder')}
              className="bg-card text-foreground focus:ring-brand w-full rounded-lg px-4 py-3 outline-none focus:ring-2"
            />
          </div>

          {services.length > 1 && (
            <div>
              <label className="text-muted-foreground mb-1 block text-sm">
                {t('preferredService')}
              </label>
              <ServiceSelector
                services={services}
                selectedId={services.find((s) => s.durationMinutes === preferredDuration)?.id ?? ''}
                onChange={(service) => setPreferredDuration(service.durationMinutes)}
              />
            </div>
          )}
        </div>

        {/* Save Button */}
        <PrimaryButton onClick={handleSave} disabled={isSaving}>
          {isSaving ? tc('saving') : tc('save')}
        </PrimaryButton>

        {/* Notification Preferences */}
        <div>
          <h3 className="text-muted-foreground mb-3 text-sm">{t('notifications')}</h3>
          <div className="bg-card divide-border divide-y rounded-lg">
            {[
              {
                key: 'notifyBookingStatus' as const,
                label: t('notifyBookingStatus'),
                desc: t('notifyBookingStatusDesc'),
                value: notifyBookingStatus,
              },
              {
                key: 'notifyCancellations' as const,
                label: t('notifyCancellations'),
                desc: t('notifyCancellationsDesc'),
                value: notifyCancellations,
              },
              {
                key: 'notifyReminders' as const,
                label: t('notifyReminders'),
                desc: t('notifyRemindersDesc'),
                value: notifyReminders,
              },
              {
                key: 'notifyDaysOff' as const,
                label: t('notifyDaysOff'),
                desc: t('notifyDaysOffDesc'),
                value: notifyDaysOff,
              },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-muted-foreground text-xs">{item.desc}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleNotification(item.key, !item.value)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    item.value ? 'bg-brand' : 'bg-switch-background'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      item.value ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Theme */}
        <div>
          <h3 className="text-muted-foreground mb-3 text-sm">{t('theme')}</h3>
          <ThemeSelector />
        </div>

        {/* Language */}
        <div>
          <h3 className="text-muted-foreground mb-3 text-sm">{tl('language')}</h3>
          <LanguageSelector />
        </div>

        {editorImage && (
          <PhotoEditor
            imageSrc={editorImage}
            onConfirm={handleEditorConfirm}
            onCancel={() => setEditorImage(null)}
          />
        )}
      </div>
    </div>
  );
}
