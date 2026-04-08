'use client';

import { Camera, Plus, X } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { PrimaryButton } from '@/components/PrimaryButton';
import { ServiceCard } from '@/components/ServiceCard';
import { TopBar } from '@/components/TopBar';
import { invalidateServices } from '@/hooks/mutations';
import { useAdminServices } from '@/hooks/queries';
import { api, getPhotoUrl } from '@/lib/api';

import type { TServiceFormData, TSessionType } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the services page UI and related interactions.
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
export default function ServicesPage(): ReactNode {
  /***************************************************************************************************
   * Defines the t value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const t = useTranslations('AdminServices');
  /***************************************************************************************************
   * Defines the tc value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const tc = useTranslations('Common');
  /***************************************************************************************************
   * Defines the td value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const td = useTranslations('Duration');
  /***************************************************************************************************
   * Defines the te value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const te = useTranslations('Errors');
  /***************************************************************************************************
   * Defines the tsp value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const tsp = useTranslations('ServicesPage');
  const { data: services, isLoading, mutate } = useAdminServices();
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState<TSessionType | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  /***************************************************************************************************
   * Defines the file input ref value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<TServiceFormData>({
    type: 'personal',
    name: '',
    price: '',
    duration: '60',
    imageUrl: '',
  });

  /***************************************************************************************************
   * Handles add click.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleAddClick = (): void => {
    setEditingService(null);
    setFormData({ type: 'personal', name: '', price: '', duration: '60', imageUrl: '' });
    setShowForm(true);
  };

  /***************************************************************************************************
   * Handles edit click.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleEditClick = (service: TSessionType): void => {
    setEditingService(service);
    setFormData({
      type: service.type,
      name: service.name,
      price: service.price.toString(),
      duration: service.durationMinutes.toString(),
      imageUrl: service.imageUrl || '',
    });
    setShowForm(true);
  };

  /***************************************************************************************************
   * Handles image upload.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
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

    setUploading(true);
    try {
      /***************************************************************************************************
       * Defines the result value used by the page layer.
       *
       * Usage context:
       * - Reused by the page layer to keep shared values centralized.
       ***************************************************************************************************/
      const result = await api.admin.uploadPhoto(file);
      setFormData((prev) => ({ ...prev, imageUrl: result.fileId }));
    } catch (err) {
      console.error('Failed to upload image:', err);
      toast.error(te('photoUploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  /***************************************************************************************************
   * Handles save.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleSave = async (): Promise<void> => {
    if (!formData.name || !formData.price || !formData.duration) {
      return;
    }

    setSaving(true);

    try {
      if (editingService) {
        await api.admin.updateService(editingService.id, {
          type: formData.type,
          name: formData.name,
          price: parseInt(formData.price),
          durationMinutes: parseInt(formData.duration),
          imageUrl: formData.imageUrl,
        });
      } else {
        await api.admin.createService({
          type: formData.type,
          name: formData.name,
          price: parseInt(formData.price),
          durationMinutes: parseInt(formData.duration),
          currency: 'RUB',
          imageUrl: formData.imageUrl,
        });
      }

      await mutate();
      invalidateServices();
      setShowForm(false);
      setEditingService(null);
    } catch (err) {
      console.error('Failed to save service:', err);
      toast.error(err instanceof Error ? err.message : te('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div>
        <TopBar title={t('title')} showBack />
        <div className={'flex min-h-[200px] items-center justify-center p-4'}>
          <div className={'text-muted-foreground'}>{tc('loading')}</div>
        </div>
      </div>
    );
  }

  if (showForm) {
    return (
      <div>
        <TopBar
          title={editingService ? t('editTitle') : t('addTitle')}
          showBack
          onBack={() => setShowForm(false)}
        />

        <div className={'space-y-4 p-4'}>
          {/***************************************************************************************************
           * Image Upload.
           ***************************************************************************************************/}
          <div>
            <label className={'text-muted-foreground mb-1 block text-sm'}>
              {t('servicePhoto')}
            </label>
            <div className={'flex items-center gap-3'}>
              <div
                onClick={() => fileInputRef.current?.click()}
                className={
                  'bg-card border-border flex h-16 w-16 cursor-pointer items-center justify-center overflow-hidden rounded-full border transition-opacity active:opacity-80'
                }
              >
                {formData.imageUrl ? (
                  <Image
                    width={64}
                    height={64}
                    src={getPhotoUrl(formData.imageUrl)}
                    alt={t('servicePhoto')}
                    className={'h-full w-full object-cover'}
                  />
                ) : (
                  <Camera className={'text-muted-foreground h-6 w-6'} />
                )}
              </div>
              {formData.imageUrl && (
                <button
                  type={'button'}
                  onClick={() => setFormData((prev) => ({ ...prev, imageUrl: '' }))}
                  className={'bg-card flex h-8 w-8 items-center justify-center rounded-full'}
                >
                  <X className={'text-muted-foreground h-4 w-4'} />
                </button>
              )}
              {uploading && (
                <span className={'text-muted-foreground text-xs'}>{tc('uploading')}</span>
              )}
            </div>
            <input
              ref={fileInputRef}
              type={'file'}
              accept={'image/*'}
              onChange={handleImageUpload}
              className={'hidden'}
            />
          </div>

          <div>
            <label className={'text-muted-foreground mb-1 block text-sm'}>{t('serviceType')}</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className={
                'bg-card text-foreground focus:ring-brand w-full rounded-lg px-4 py-3 outline-none focus:ring-2'
              }
            >
              <option value={'personal'}>{t('typePersonal')}</option>
              <option value={'pair'}>{t('typePair')}</option>
              <option value={'consultation'}>{t('typeConsultation')}</option>
            </select>
          </div>

          <div>
            <label className={'text-muted-foreground mb-1 block text-sm'}>{t('nameLabel')}</label>
            <input
              type={'text'}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              maxLength={100}
              placeholder={t('namePlaceholder')}
              className={
                'bg-card text-foreground focus:ring-brand w-full rounded-lg px-4 py-3 outline-none focus:ring-2'
              }
            />
          </div>

          <div>
            <label className={'text-muted-foreground mb-1 block text-sm'}>{t('priceLabel')}</label>
            <input
              type={'number'}
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              placeholder={t('pricePlaceholder')}
              className={
                'bg-card text-foreground focus:ring-brand w-full rounded-lg px-4 py-3 outline-none focus:ring-2'
              }
            />
          </div>

          <div>
            <label className={'text-muted-foreground mb-1 block text-sm'}>
              {t('durationLabel')}
            </label>
            <div className={'grid grid-cols-3 gap-2'}>
              {[
                { label: td('min30'), value: '30' },
                { label: td('hour1'), value: '60' },
                { label: td('hour1_5'), value: '90' },
                { label: td('hour2'), value: '120' },
                { label: td('hour2_5'), value: '150' },
                { label: td('hour3'), value: '180' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type={'button'}
                  onClick={() => setFormData({ ...formData, duration: opt.value })}
                  className={`rounded-lg py-3 text-sm font-medium transition-colors ${
                    formData.duration === opt.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <PrimaryButton onClick={handleSave} disabled={saving}>
            {saving ? tc('saving') : editingService ? tc('save') : t('addButton')}
          </PrimaryButton>
        </div>
      </div>
    );
  }

  return (
    <div>
      <TopBar title={t('title')} showBack />

      <div className={'space-y-4 p-4'}>
        <p className={'text-muted-foreground text-xs'}>{tsp('durationDeterminesSlots')}</p>

        {/***************************************************************************************************
         * Add Button.
         ***************************************************************************************************/}
        <button
          onClick={handleAddClick}
          className={
            'border-border text-muted-foreground active:bg-card flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-3 transition-colors'
          }
        >
          <Plus className={'h-5 w-5'} />
          <span>{tsp('addService')}</span>
        </button>

        {/***************************************************************************************************
         * Services List.
         ***************************************************************************************************/}
        {services.length === 0 ? (
          <div className={'text-muted-foreground py-8 text-center'}>{tsp('noServices')}</div>
        ) : (
          services.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onEdit={() => handleEditClick(service)}
            />
          ))
        )}
      </div>
    </div>
  );
}
