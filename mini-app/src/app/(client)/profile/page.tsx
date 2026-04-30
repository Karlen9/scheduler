'use client';

import { Trash2 } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { setLocale } from '@/actions/locale';
import { LanguageSelector } from '@/components/LanguageSelector';
import { PhotoEditor } from '@/components/PhotoEditor';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ThemeSelector } from '@/components/ThemeSelector';
import { invalidateProfile } from '@/hooks/mutations';
import { useProfile } from '@/hooks/queries';
import { api } from '@/lib/api';
import { isPreviewRoute } from '@/lib/routes';
import { getTelegramUserPhotoUrl, waitForTelegramUserPhotoUrl } from '@/lib/telegram';

import { AvatarSection } from './AvatarSection';
import { NotificationPreferences } from './NotificationPreferences';

import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the client profile page UI and related interactions.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - The computed value for the current operation as ReactNode.
 *
 * Side effects:
 * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
 ***************************************************************************************************/
export default function ClientProfilePage(): ReactNode {
  /***************************************************************************************************
   * Defines the t value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const t = useTranslations('ProfilePage');
  /***************************************************************************************************
   * Defines the tc value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const tc = useTranslations('Common');
  /***************************************************************************************************
   * Defines the te value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const te = useTranslations('Errors');
  /***************************************************************************************************
   * Defines the ts value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const ts = useTranslations('Success');
  /***************************************************************************************************
   * Defines the tl value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const tl = useTranslations('LanguageSelector');
  const tp = useTranslations('PreviewMode');
  /***************************************************************************************************
   * Defines the locale value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const locale = useLocale();
  const pathname = usePathname();
  /***************************************************************************************************
   * Defines the router value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const router = useRouter();
  const { data: profile, isLoading: loading, mutate } = useProfile();
  const isPreview = isPreviewRoute(pathname);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [telegramPhotoUrl, setTelegramPhotoUrl] = useState('');
  const [photoError, setPhotoError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false);
  const [editorImage, setEditorImage] = useState<string | null>(null);
  /***************************************************************************************************
   * Defines the file input ref value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
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
      setPhotoError(false);
      setNotifyBookingStatus(profile.notifyBookingStatus ?? true);
      setNotifyReminders(profile.notifyReminders ?? true);
      setNotifyDaysOff(profile.notifyDaysOff ?? false);
      setNotifyCancellations(profile.notifyCancellations ?? true);
    }
  }, [profile]);

  useEffect(() => {
    let active = true;
    const currentPhotoUrl = getTelegramUserPhotoUrl();
    if (currentPhotoUrl) {
      setTelegramPhotoUrl(currentPhotoUrl);
    }

    void waitForTelegramUserPhotoUrl().then((photo) => {
      if (active && photo) {
        setTelegramPhotoUrl(photo);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  /***************************************************************************************************
   * Cross-device language sync.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const syncingLanguageRef = useRef<string | null>(null);
  useEffect(() => {
    const targetLanguage = profile?.language;
    if (!targetLanguage || targetLanguage === locale) {
      syncingLanguageRef.current = null;
      return;
    }

    if (syncingLanguageRef.current === targetLanguage) {
      return;
    }

    let active = true;
    syncingLanguageRef.current = targetLanguage;

    void (async () => {
      try {
        await setLocale(targetLanguage);
        if (!active) {
          return;
        }
        router.refresh();
      } catch (err) {
        if (!active) {
          return;
        }
        syncingLanguageRef.current = null;
        console.error('Failed to sync locale:', err);
      }
    })();

    return () => {
      active = false;
    };
  }, [profile?.language, locale, router]);

  /***************************************************************************************************
   * Handles file select.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
    /***************************************************************************************************
     * Defines the file value used by the page layer.
     *
     * Usage context:
     * - Reused by the page layer to keep shared values centralized.
     ***************************************************************************************************/
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    /***************************************************************************************************
     * Defines the url value used by the page layer.
     *
     * Usage context:
     * - Reused by the page layer to keep shared values centralized.
     ***************************************************************************************************/
    const url = URL.createObjectURL(file);
    setEditorImage(url);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  /***************************************************************************************************
   * Handles editor confirm.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleEditorConfirm = useCallback(
    async (blob: Blob): Promise<void> => {
      setEditorImage(null);
      setIsUploading(true);
      try {
        /***************************************************************************************************
         * Defines the file value used by the page layer.
         *
         * Usage context:
         * - Reused by the page layer to keep shared values centralized.
         ***************************************************************************************************/
        const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
        /***************************************************************************************************
         * Defines the result value used by the page layer.
         *
         * Usage context:
         * - Reused by the page layer to keep shared values centralized.
         ***************************************************************************************************/
        const result = await api.uploadPhoto(file);
        setPhotoUrl(result.fileId);
        setPhotoError(false);
        if (profile) {
          await mutate(async () => ({ ...profile, photoUrl: result.fileId }), {
            revalidate: false,
            populateCache: true,
          });
        }
        invalidateProfile();
        toast.success(ts('photoUpdated'));
      } catch (err) {
        console.error('Failed to upload photo:', err);
        toast.error(te('photoUploadFailed'));
      } finally {
        setIsUploading(false);
      }
    },
    [mutate, profile, te, ts],
  );

  const handleDeletePhoto = useCallback(async (): Promise<void> => {
    setIsDeletingPhoto(true);

    try {
      const fallbackTelegramPhotoUrl =
        telegramPhotoUrl || getTelegramUserPhotoUrl() || (await waitForTelegramUserPhotoUrl());
      const updatedProfile = await api.updateProfile({ photoUrl: '' });
      if (updatedProfile.photoUrl?.startsWith('http')) {
        setTelegramPhotoUrl(updatedProfile.photoUrl);
      } else if (fallbackTelegramPhotoUrl) {
        setTelegramPhotoUrl(fallbackTelegramPhotoUrl);
      }
      setPhotoUrl(updatedProfile.photoUrl || '');
      setPhotoError(false);

      if (profile) {
        await mutate(async () => updatedProfile, {
          populateCache: true,
          revalidate: false,
        });
      } else {
        invalidateProfile();
      }
      invalidateProfile();
      toast.success(ts('photoRemoved'));
    } catch (err) {
      console.error('Failed to delete photo:', err);
      toast.error(te('saveFailed'));
    } finally {
      setIsDeletingPhoto(false);
    }
  }, [mutate, profile, te, telegramPhotoUrl, ts]);

  /***************************************************************************************************
   * Handles save.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleSave = useCallback(async (): Promise<void> => {
    setIsSaving(true);

    const nextProfile = {
      name,
      phone,
    };

    try {
      if (profile) {
        await mutate(async () => api.updateProfile(nextProfile), {
          optimisticData: { ...profile, ...nextProfile },
          rollbackOnError: true,
          populateCache: true,
          revalidate: false,
        });
      } else {
        await api.updateProfile(nextProfile);
        invalidateProfile();
      }
      toast.success(ts('profileSaved'));
    } catch (err) {
      console.error('Failed to save profile:', err);
      toast.error(te('saveFailed'));
    } finally {
      setIsSaving(false);
    }
  }, [mutate, name, phone, profile, te, ts]);

  /***************************************************************************************************
   * Defines the handle toggle notification value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleToggleNotification = useCallback(
    async (
      key: 'notifyBookingStatus' | 'notifyReminders' | 'notifyDaysOff' | 'notifyCancellations',
      value: boolean,
    ): Promise<void> => {
      /***************************************************************************************************
       * Defines the setters value used by the page layer.
       *
       * Usage context:
       * - Reused by the page layer to keep shared values centralized.
       ***************************************************************************************************/
      const setters = {
        notifyBookingStatus: setNotifyBookingStatus,
        notifyReminders: setNotifyReminders,
        notifyDaysOff: setNotifyDaysOff,
        notifyCancellations: setNotifyCancellations,
      };
      setters[key](value);
      try {
        if (profile) {
          await mutate(async () => api.updateNotificationPrefs({ [key]: value }), {
            optimisticData: { ...profile, [key]: value },
            rollbackOnError: true,
            populateCache: true,
            revalidate: false,
          });
        } else {
          await api.updateNotificationPrefs({ [key]: value });
          invalidateProfile();
        }
      } catch {
        setters[key](!value);
        toast.error(te('saveSettingsFailed'));
      }
    },
    [mutate, profile, te],
  );

  if (loading) {
    return (
      <div className={'animate-pulse space-y-6 p-4'}>
        <div className={'flex justify-center pt-2'}>
          <div className={'bg-card h-24 w-24 rounded-full'} />
        </div>
        <div className={'space-y-4'}>
          <div>
            <div className={'bg-card mb-2 h-4 w-10 rounded'} />
            <div className={'bg-card h-12 rounded-lg'} />
          </div>
          <div>
            <div className={'bg-card mb-2 h-4 w-16 rounded'} />
            <div className={'bg-card h-12 rounded-lg'} />
          </div>
        </div>
        <div className={'bg-card h-12 rounded-lg'} />
      </div>
    );
  }

  const displayPhotoUrl = photoUrl || telegramPhotoUrl;
  const hasPhoto = Boolean(displayPhotoUrl);
  const isTelegramPhotoActive = Boolean(
    telegramPhotoUrl && (!photoUrl || photoUrl === telegramPhotoUrl),
  );
  const canDeletePhoto = Boolean(photoUrl && !isTelegramPhotoActive);

  return (
    <div>
      <div className={'space-y-6 p-4'}>
        <AvatarSection
          name={name}
          photoUrl={displayPhotoUrl}
          photoError={photoError}
          isUploading={isUploading}
          disabled={isPreview}
          onPhotoError={() => setPhotoError(true)}
          onClickUpload={() => fileInputRef.current?.click()}
          fileInputRef={fileInputRef}
          onFileSelect={handleFileSelect}
        />

        {!isPreview && hasPhoto && (
          <div className={'-mt-4 flex justify-center'}>
            {canDeletePhoto ? (
              <button
                type={'button'}
                onClick={handleDeletePhoto}
                disabled={isDeletingPhoto || isUploading}
                className={
                  'text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors disabled:opacity-50'
                }
              >
                {isDeletingPhoto ? (
                  <div
                    className={
                      'border-muted-foreground h-4 w-4 animate-spin rounded-full border-2 border-t-transparent'
                    }
                  />
                ) : (
                  <Trash2 className={'h-4 w-4'} />
                )}
                {telegramPhotoUrl ? t('useTelegramPhoto') : t('removePhoto')}
              </button>
            ) : (
              <p className={'text-muted-foreground px-3 py-2 text-sm'}>
                {t('telegramPhotoActive')}
              </p>
            )}
          </div>
        )}

        {isPreview && (
          <div className={'bg-card text-muted-foreground rounded-xl px-4 py-3 text-sm'}>
            {tp('profileNotice')}
          </div>
        )}

        {/***************************************************************************************************
         * Form.
         ***************************************************************************************************/}
        <div className={'space-y-4'}>
          <div>
            <label className={'text-muted-foreground mb-1 block text-sm'}>{t('nameLabel')}</label>
            <input
              type={'text'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              readOnly={isPreview}
              className={
                'bg-card text-foreground focus:ring-brand w-full rounded-lg px-4 py-3 outline-none focus:ring-2'
              }
            />
          </div>

          <div>
            <label className={'text-muted-foreground mb-1 block text-sm'}>{t('phoneLabel')}</label>
            <input
              type={'tel'}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={20}
              placeholder={t('phonePlaceholder')}
              readOnly={isPreview}
              className={
                'bg-card text-foreground focus:ring-brand w-full rounded-lg px-4 py-3 outline-none focus:ring-2'
              }
            />
          </div>
        </div>

        {!isPreview && (
          <PrimaryButton onClick={handleSave} disabled={isSaving}>
            {isSaving ? tc('saving') : tc('save')}
          </PrimaryButton>
        )}

        <NotificationPreferences
          notifyBookingStatus={notifyBookingStatus}
          notifyReminders={notifyReminders}
          notifyDaysOff={notifyDaysOff}
          notifyCancellations={notifyCancellations}
          disabled={isPreview}
          onToggle={handleToggleNotification}
        />

        {!isPreview && (
          <>
            <div>
              <h3 className={'text-muted-foreground mb-3 text-sm'}>{t('theme')}</h3>
              <ThemeSelector />
            </div>

            <div>
              <h3 className={'text-muted-foreground mb-3 text-sm'}>{tl('language')}</h3>
              <LanguageSelector />
            </div>
          </>
        )}

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
