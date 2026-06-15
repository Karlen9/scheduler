'use client';

import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ServiceCard } from '@/components/ServiceCard';
import { TopBar } from '@/components/TopBar';
import { invalidateServices } from '@/hooks/mutations';
import { useAdminServices, useSpecialist } from '@/hooks/queries';
import { api } from '@/lib/api';

import type { TServiceFormData, TSessionType } from '@/lib/types';
import type { ReactNode } from 'react';

const serviceDurationOptions = [30, 45, 60, 75, 90, 105, 120, 180];

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
  const { data: specialist } = useSpecialist();
  const isPro = specialist?.isPro ?? true;
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState<TSessionType | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TSessionType | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState<TServiceFormData>({
    type: 'common',
    name: '',
    price: '',
    duration: '60',
    sessionsCount: '10',
  });

  /***************************************************************************************************
   * Handles add click.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleAddClick = (): void => {
    setEditingService(null);
    setFormData({ type: 'common', name: '', price: '', duration: '60', sessionsCount: '10' });
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
      sessionsCount: (service.sessionsCount ?? 10).toString(),
    });
    setShowForm(true);
  };

  /***************************************************************************************************
   * Handles save.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleSave = async (): Promise<void> => {
    const sessionsCount = parseInt(formData.sessionsCount, 10);
    if (
      !formData.name ||
      !formData.price ||
      !formData.duration ||
      (formData.type === 'batch' && (!Number.isFinite(sessionsCount) || sessionsCount <= 1))
    ) {
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
          sessionsCount: formData.type === 'batch' ? sessionsCount : undefined,
        });
      } else {
        await api.admin.createService({
          type: formData.type,
          name: formData.name,
          price: parseInt(formData.price),
          durationMinutes: parseInt(formData.duration),
          currency: 'RUB',
          sessionsCount: formData.type === 'batch' ? sessionsCount : undefined,
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

  const handleConfirmDelete = async (): Promise<void> => {
    if (!deleteTarget) {
      return;
    }
    setDeleting(true);
    try {
      await api.admin.deleteService(deleteTarget.id);
      await mutate();
      invalidateServices();
      setDeleteTarget(null);
    } catch (err) {
      console.error('Failed to delete service:', err);
      toast.error(err instanceof Error ? err.message : te('saveFailed'));
    } finally {
      setDeleting(false);
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
          <div>
            <label className={'text-muted-foreground mb-1 block text-sm'}>{t('serviceType')}</label>
            <select
              value={formData.type}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  type: e.target.value,
                  sessionsCount: e.target.value === 'batch' ? formData.sessionsCount || '10' : '10',
                })
              }
              className={
                'bg-card text-foreground focus:ring-brand w-full rounded-lg px-4 py-3 outline-none focus:ring-2'
              }
            >
              <option value={'common'}>{t('typeCommon')}</option>
              <option value={'batch'} disabled={!isPro && formData.type !== 'batch'}>
                {t('typeBatch')}
                {!isPro && formData.type !== 'batch' ? ' · Pro' : ''}
              </option>
            </select>
          </div>

          {formData.type === 'batch' && (
            <div>
              <label className={'text-muted-foreground mb-1 block text-sm'}>
                {t('sessionsCountLabel')}
              </label>
              <input
                type={'number'}
                min={2}
                value={formData.sessionsCount}
                onChange={(e) => setFormData({ ...formData, sessionsCount: e.target.value })}
                placeholder={t('sessionsCountPlaceholder')}
                className={
                  'bg-card text-foreground focus:ring-brand w-full rounded-lg px-4 py-3 outline-none focus:ring-2'
                }
              />
            </div>
          )}

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
              {serviceDurationOptions.map((duration) => (
                <button
                  key={duration}
                  type={'button'}
                  onClick={() => setFormData({ ...formData, duration: duration.toString() })}
                  className={`rounded-lg py-3 text-sm font-medium transition-colors ${
                    formData.duration === duration.toString()
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card text-foreground'
                  }`}
                >
                  {duration} {tc('min')}
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
              onDelete={() => setDeleteTarget(service)}
            />
          ))
        )}
      </div>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => (deleting ? undefined : setDeleteTarget(null))}
        onConfirm={handleConfirmDelete}
        title={t('deleteDialog')}
        description={t('deleteDialogDescription', { name: deleteTarget?.name || '' })}
        confirmText={deleting ? tc('saving') : t('deleteConfirm')}
        confirmDisabled={deleting}
        destructive
      />
    </div>
  );
}
