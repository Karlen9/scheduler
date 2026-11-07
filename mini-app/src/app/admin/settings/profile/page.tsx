'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { PrimaryButton } from '@/components/PrimaryButton';
import { TopBar } from '@/components/TopBar';
import { invalidateSpecialist } from '@/hooks/mutations';
import { useAdminProfile } from '@/hooks/queries';
import { api, getPhotoUrl } from '@/lib/api';
import { getAvatarColor } from '@/lib/colors';
import { getTelegramPhotoDisplayUrl, isStoredTelegramProfilePhoto } from '@/lib/photos';
import { getTelegramUserPhotoUrl, waitForTelegramUserPhotoUrl } from '@/lib/telegram';

import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the profile page UI and related interactions.
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
export default function ProfilePage(): ReactNode {
  /***************************************************************************************************
   * Defines the t value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const t = useTranslations('AdminProfile');
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
  const { data: profile, isLoading } = useAdminProfile();
  const [name, setName] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [bio, setBio] = useState('');
  const [phone, setPhone] = useState('');
  const [telegram, setTelegram] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');
  const [telegramPhotoUrl, setTelegramPhotoUrl] = useState('');
  const [telegramPhotoVersion, setTelegramPhotoVersion] = useState(() => String(Date.now()));
  const [photoError, setPhotoError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isLoading || initialized || !profile) {
      return;
    }

    setName(profile.name || '');
    setSpecialization(profile.specialization || '');
    setBio(profile.bio || '');
    setPhone(profile.phone || '');
    setTelegram(profile.telegramHandle || '');
    setPhotoUrl(profile.photoUrl || '');
    if (isStoredTelegramProfilePhoto(profile.photoUrl)) {
      setTelegramPhotoVersion(String(Date.now()));
    }
    setInitialized(true);
  }, [profile, isLoading, initialized]);

  useEffect(() => {
    let active = true;
    const currentPhotoUrl = getTelegramUserPhotoUrl();
    if (currentPhotoUrl) {
      setTelegramPhotoUrl(currentPhotoUrl);
      setTelegramPhotoVersion(String(Date.now()));
    }

    void waitForTelegramUserPhotoUrl().then((photo) => {
      if (active && photo) {
        setTelegramPhotoUrl(photo);
        setTelegramPhotoVersion(String(Date.now()));
      }
    });

    return () => {
      active = false;
    };
  }, []);

  /***************************************************************************************************
   * Handles save.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleSave = async (): Promise<void> => {
    setIsSaving(true);
    try {
      await api.admin.updateProfile({
        name,
        specialization,
        bio,
        phone,
        telegramHandle: telegram,
      });
      invalidateSpecialist();
      toast.success(ts('profileSaved'));
    } catch (err) {
      console.error('Failed to save profile:', err);
      toast.error(te('saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div>
        <TopBar title={t('title')} showBack />
        <div className={'animate-pulse space-y-6 p-4'}>
          <div className={'flex justify-center'}>
            <div className={'bg-card h-24 w-24 rounded-full'} />
          </div>
          <div className={'space-y-4'}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i}>
                <div className={'bg-card mb-2 h-4 w-20 rounded'} />
                <div className={'bg-card h-12 rounded-lg'} />
              </div>
            ))}
          </div>
          <div className={'bg-card h-12 rounded-lg'} />
        </div>
      </div>
    );
  }

  /***************************************************************************************************
   * The photo is read-only: it always mirrors the specialist's Telegram profile photo. Prefer the
   * live SDK value (available immediately) over the stored one so it renders without waiting on
   * the backend.
   ***************************************************************************************************/
  const isCurrentTelegramPhoto = isStoredTelegramProfilePhoto(photoUrl);
  const storedPhotoUrl = isCurrentTelegramPhoto
    ? getTelegramPhotoDisplayUrl(photoUrl, telegramPhotoVersion)
    : photoUrl;
  const displayPhotoUrl = telegramPhotoUrl || storedPhotoUrl;
  const photoSrc = displayPhotoUrl && !photoError ? getPhotoUrl(displayPhotoUrl) : null;

  return (
    <div>
      <TopBar title={t('title')} showBack />

      <div className={'space-y-6 p-4'}>
        {/***************************************************************************************************
         * Avatar.
         ***************************************************************************************************/}
        <div className={'flex justify-center'}>
          {photoSrc ? (
            <Image
              width={96}
              height={96}
              src={photoSrc}
              alt={name}
              unoptimized
              className={'h-24 w-24 rounded-full object-cover'}
              onError={() => setPhotoError(true)}
            />
          ) : (
            <div
              className={`flex h-24 w-24 items-center justify-center rounded-full text-3xl ${name ? getAvatarColor(name) : 'bg-card text-muted-foreground'}`}
            >
              {name.charAt(0) || '?'}
            </div>
          )}
        </div>

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
              className={
                'bg-card text-foreground focus:ring-brand w-full rounded-lg px-4 py-3 outline-none focus:ring-2'
              }
            />
          </div>

          <div>
            <label className={'text-muted-foreground mb-1 block text-sm'}>
              {t('specializationLabel')}
            </label>
            <input
              type={'text'}
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
              maxLength={100}
              className={
                'bg-card text-foreground focus:ring-brand w-full rounded-lg px-4 py-3 outline-none focus:ring-2'
              }
            />
          </div>

          <div>
            <label className={'text-muted-foreground mb-1 block text-sm'}>{t('bioLabel')}</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={1000}
              rows={4}
              placeholder={t('bioPlaceholder')}
              className={
                'bg-card text-foreground focus:ring-brand w-full resize-none rounded-lg px-4 py-3 outline-none focus:ring-2'
              }
            />
            <p className={'text-muted-foreground mt-1 text-right text-xs'}>
              {bio.length}
              {'/1000'}
            </p>
          </div>

          <div>
            <label className={'text-muted-foreground mb-1 block text-sm'}>{t('phoneLabel')}</label>
            <input
              type={'tel'}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={20}
              className={
                'bg-card text-foreground focus:ring-brand w-full rounded-lg px-4 py-3 outline-none focus:ring-2'
              }
            />
          </div>

          <div>
            <label className={'text-muted-foreground mb-1 block text-sm'}>
              {t('telegramLabel')}
            </label>
            <input
              type={'text'}
              value={telegram}
              onChange={(e) => setTelegram(e.target.value)}
              maxLength={50}
              placeholder={t('telegramPlaceholder')}
              className={
                'bg-card text-foreground focus:ring-brand w-full rounded-lg px-4 py-3 outline-none focus:ring-2'
              }
            />
          </div>
        </div>

        {/***************************************************************************************************
         * Save Button.
         ***************************************************************************************************/}
        <PrimaryButton onClick={handleSave} disabled={isSaving}>
          {isSaving ? tc('saving') : tc('save')}
        </PrimaryButton>
      </div>
    </div>
  );
}
