'use client';

import { Camera } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { PhotoEditor } from '@/components/PhotoEditor';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TopBar } from '@/components/TopBar';
import { invalidateSpecialist } from '@/hooks/mutations';
import { useAdminProfile } from '@/hooks/queries';
import { api, getPhotoUrl } from '@/lib/api';
import { getAvatarColor } from '@/lib/colors';

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
  const [gymCoords, setGymCoords] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoError, setPhotoError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editorImage, setEditorImage] = useState<string | null>(null);
  /***************************************************************************************************
   * Defines the file input ref value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (profile.locationLatitude && profile.locationLongitude) {
      setGymCoords(`${profile.locationLatitude}, ${profile.locationLongitude}`);
    }
    setInitialized(true);
  }, [profile, isLoading, initialized]);

  /***************************************************************************************************
   * Handles file select.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>): void => {
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
  };

  /***************************************************************************************************
   * Handles editor confirm.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleEditorConfirm = async (blob: Blob): Promise<void> => {
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
      const result = await api.admin.uploadPhoto(file);
      setPhotoUrl(result.fileId);
      setPhotoError(false);
      invalidateSpecialist();
      toast.success(ts('photoUpdated'));
    } catch (err) {
      console.error('Failed to upload photo:', err);
      toast.error(te('photoUploadFailed'));
    } finally {
      setIsUploading(false);
    }
  };

  /***************************************************************************************************
   * Handles save.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleSave = async (): Promise<void> => {
    setIsSaving(true);
    try {
      /***************************************************************************************************
       * Defines the location latitude value used by the page layer.
       *
       * Usage context:
       * - Reused by the page layer to keep shared values centralized.
       ***************************************************************************************************/
      let locationLatitude = 0;
      /***************************************************************************************************
       * Defines the location longitude value used by the page layer.
       *
       * Usage context:
       * - Reused by the page layer to keep shared values centralized.
       ***************************************************************************************************/
      let locationLongitude = 0;
      if (gymCoords.trim()) {
        /***************************************************************************************************
         * Defines the parts value used by the page layer.
         *
         * Usage context:
         * - Reused by the page layer to keep shared values centralized.
         ***************************************************************************************************/
        const parts = gymCoords.split(',').map((s) => parseFloat(s.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          locationLatitude = parts[0];
          locationLongitude = parts[1];
        }
      }
      await api.admin.updateProfile({
        name,
        specialization,
        bio,
        phone,
        telegramHandle: telegram,
        locationLatitude,
        locationLongitude,
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

  return (
    <div>
      <TopBar title={t('title')} showBack />

      <div className={'space-y-6 p-4'}>
        {/***************************************************************************************************
         * Avatar.
         ***************************************************************************************************/}
        <div className={'flex justify-center'}>
          <div className={'relative cursor-pointer'} onClick={() => fileInputRef.current?.click()}>
            {photoUrl && !photoError ? (
              <img
                src={getPhotoUrl(photoUrl)}
                alt={name}
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
            <div
              className={
                'bg-brand absolute right-0 bottom-0 flex h-8 w-8 items-center justify-center rounded-full shadow-lg'
              }
            >
              {isUploading ? (
                <div
                  className={
                    'h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent'
                  }
                />
              ) : (
                <Camera className={'h-4 w-4 text-white'} />
              )}
            </div>
            <input
              ref={fileInputRef}
              type={'file'}
              accept={'image/jpeg,image/png,image/webp'}
              className={'hidden'}
              onChange={handleFileSelect}
            />
          </div>
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
              maxLength={500}
              rows={4}
              placeholder={t('bioPlaceholder')}
              className={
                'bg-card text-foreground focus:ring-brand w-full resize-none rounded-lg px-4 py-3 outline-none focus:ring-2'
              }
            />
            <p className={'text-muted-foreground mt-1 text-right text-xs'}>
              {bio.length}
              {'/500'}
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

          {/***************************************************************************************************
           * Location.
           ***************************************************************************************************/}
          <div className={'pt-2'}>
            <label className={'text-muted-foreground mb-1 block text-sm'}>
              {t('gymCoordsLabel')}
            </label>
            <input
              type={'text'}
              value={gymCoords}
              onChange={(e) => setGymCoords(e.target.value)}
              placeholder={t('gymCoordsPlaceholder')}
              className={
                'bg-card text-foreground focus:ring-brand w-full rounded-lg px-4 py-3 outline-none focus:ring-2'
              }
            />
            <p className={'text-muted-foreground mt-1.5 text-xs'}>{t('gymCoordsHint')}</p>
          </div>
        </div>

        {/***************************************************************************************************
         * Save Button.
         ***************************************************************************************************/}
        <PrimaryButton onClick={handleSave} disabled={isSaving}>
          {isSaving ? tc('saving') : tc('save')}
        </PrimaryButton>
      </div>

      {editorImage && (
        <PhotoEditor
          imageSrc={editorImage}
          onConfirm={handleEditorConfirm}
          onCancel={() => setEditorImage(null)}
        />
      )}
    </div>
  );
}
