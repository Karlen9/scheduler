'use client';

import { Crown } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useSWRConfig } from 'swr';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Switch } from '@/components/Switch';
import { TopBar } from '@/components/TopBar';
import { CACHE_KEYS } from '@/hooks/cache-keys';
import { useSubscription } from '@/hooks/queries';
import { api } from '@/lib/api';
import { getTelegramWebApp } from '@/lib/telegram';

import type { TSubscriptionPlan } from '@/lib/types';
import type { ReactNode } from 'react';

export default function SubscriptionPage(): ReactNode {
  const t = useTranslations('Subscription');
  const locale = useLocale();
  const { data, isLoading, mutate } = useSubscription();
  const { mutate: globalMutate } = useSWRConfig();

  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [promoInput, setPromoInput] = useState('');
  const [promoApplied, setPromoApplied] = useState('');
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoFinalKopecks, setPromoFinalKopecks] = useState<number | null>(null);
  const [promoChecking, setPromoChecking] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [autoRenew, setAutoRenew] = useState(true);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [actioning, setActioning] = useState(false);

  const plans: TSubscriptionPlan[] = data?.plans ?? [];

  const annualPlan = plans.find((p) => p.code === 'pro_annual');
  const defaultPlan = annualPlan?.code ?? plans[0]?.code ?? '';
  const effectivePlan = selectedPlan || defaultPlan;

  const formatDate = useCallback(
    (iso: string | undefined): string => {
      if (!iso) {
        return '';
      }
      const d = new Date(iso);
      return d.toLocaleDateString(locale === 'en' ? 'en-US' : 'ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    },
    [locale],
  );

  const daysLeft = useCallback((iso: string | undefined): number => {
    if (!iso) {
      return 0;
    }
    const diff = new Date(iso).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, []);

  const planLabel = useCallback(
    (plan: TSubscriptionPlan): string => {
      switch (plan.code) {
        case 'pro_monthly':
          return t('planMonthly');
        case 'pro_quarterly':
          return t('planQuarterly');
        case 'pro_annual':
          return t('planAnnual');
        default:
          return plan.code;
      }
    },
    [t],
  );

  const planPeriodSuffix = useCallback(
    (plan: TSubscriptionPlan): string => {
      switch (plan.code) {
        case 'pro_monthly':
          return t('planPerMonth');
        case 'pro_quarterly':
          return t('planPerQuarter');
        case 'pro_annual':
          return t('planPerYear');
        default:
          return '';
      }
    },
    [t],
  );

  const isAnnualPlan = (plan: TSubscriptionPlan): boolean => plan.code === 'pro_annual';

  const handleApplyPromo = useCallback(async (): Promise<void> => {
    if (!promoInput.trim() || !effectivePlan) {
      return;
    }
    setPromoChecking(true);
    try {
      const result = await api.admin.validatePromo(promoInput.trim(), effectivePlan);
      if (result.valid) {
        setPromoApplied(promoInput.trim());
        setPromoDiscount(result.discountKopecks ?? 0);
        setPromoFinalKopecks(result.finalKopecks ?? null);
        toast.success(
          t('promoApplied', { discount: Math.round((result.discountKopecks ?? 0) / 100) }),
        );
      } else {
        setPromoApplied('');
        setPromoDiscount(0);
        setPromoFinalKopecks(null);
        toast.error(result.reason ?? t('promoInvalid'));
      }
    } catch {
      toast.error(t('promoInvalid'));
    } finally {
      setPromoChecking(false);
    }
  }, [promoInput, effectivePlan, t]);

  const handleCheckout = useCallback(async (): Promise<void> => {
    if (!effectivePlan || checkingOut) {
      return;
    }
    setCheckingOut(true);
    try {
      const result = await api.admin.checkoutSubscription(
        effectivePlan,
        promoApplied || undefined,
        autoRenew,
      );
      if (result.granted) {
        toast.success(t('checkoutSuccess'));
        await mutate();
        await globalMutate(CACHE_KEYS.specialist);
        await globalMutate(CACHE_KEYS.adminProfile);
      } else if (result.confirmationUrl) {
        const webApp = getTelegramWebApp();
        if (webApp?.openLink) {
          webApp.openLink(result.confirmationUrl);
        } else {
          window.open(result.confirmationUrl, '_blank');
        }
      }
    } catch {
      toast.error(t('checkoutError'));
    } finally {
      setCheckingOut(false);
    }
  }, [effectivePlan, promoApplied, autoRenew, checkingOut, mutate, globalMutate, t]);

  const handleCancelAutoRenew = useCallback(async (): Promise<void> => {
    setActioning(true);
    try {
      const updated = await api.admin.cancelSubscription();
      await mutate(updated, { revalidate: false });
      toast.success(t('cancelSuccess'));
    } catch {
      toast.error(t('actionError'));
    } finally {
      setActioning(false);
      setCancelOpen(false);
    }
  }, [mutate, t]);

  const handleResumeAutoRenew = useCallback(async (): Promise<void> => {
    setActioning(true);
    try {
      const updated = await api.admin.resumeSubscription();
      await mutate(updated, { revalidate: false });
      toast.success(t('resumeSuccess'));
    } catch {
      toast.error(t('actionError'));
    } finally {
      setActioning(false);
    }
  }, [mutate, t]);

  const activePlanKopecks = (planCode: string): number => {
    if (promoApplied && promoFinalKopecks !== null && planCode === effectivePlan) {
      return promoFinalKopecks;
    }
    return plans.find((p) => p.code === planCode)?.priceKopecks ?? 0;
  };

  const renderStatus = (): ReactNode => {
    if (!data) {
      return null;
    }
    const { status, isPro, trialEndsAt, currentPeriodEndAt, cancelAtPeriodEnd } = data;

    if (status === 'trialing' && trialEndsAt) {
      return (
        <div className={'bg-card rounded-xl p-4'}>
          <div className={'flex items-center gap-3'}>
            <div
              className={
                'bg-warning/15 text-warning flex h-10 w-10 shrink-0 items-center justify-center rounded-lg'
              }
            >
              <Crown className={'h-5 w-5'} />
            </div>
            <div>
              <div className={'text-foreground font-medium'}>{t('statusTrial')}</div>
              <div className={'text-muted-foreground text-sm'}>
                {t('statusTrialDaysLeft', { days: daysLeft(trialEndsAt) })}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (isPro && currentPeriodEndAt) {
      if (cancelAtPeriodEnd) {
        return (
          <div className={'bg-card rounded-xl p-4'}>
            <div className={'flex items-center gap-3'}>
              <div
                className={
                  'bg-warning/15 text-warning flex h-10 w-10 shrink-0 items-center justify-center rounded-lg'
                }
              >
                <Crown className={'h-5 w-5'} />
              </div>
              <div>
                <div className={'text-foreground font-medium'}>{t('statusCancelled')}</div>
                <div className={'text-muted-foreground text-sm'}>
                  {t('statusCancelledUntil', { date: formatDate(currentPeriodEndAt) })}
                </div>
              </div>
            </div>
          </div>
        );
      }
      return (
        <div className={'bg-card rounded-xl p-4'}>
          <div className={'flex items-center gap-3'}>
            <div
              className={
                'bg-success/15 text-success flex h-10 w-10 shrink-0 items-center justify-center rounded-lg'
              }
            >
              <Crown className={'h-5 w-5'} />
            </div>
            <div>
              <div className={'text-foreground font-medium'}>{t('statusActive')}</div>
              <div className={'text-muted-foreground text-sm'}>
                {t('statusActiveUntil', { date: formatDate(currentPeriodEndAt) })}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (status === 'expired') {
      return (
        <div className={'bg-card rounded-xl p-4'}>
          <div className={'text-foreground font-medium'}>{t('statusExpired')}</div>
        </div>
      );
    }

    return (
      <div className={'bg-card rounded-xl p-4'}>
        <div className={'text-foreground font-medium'}>{t('statusFree')}</div>
      </div>
    );
  };

  return (
    <div>
      <TopBar title={t('title')} showBack />
      <div className={'space-y-4 p-4'}>
        {isLoading ? <div className={'bg-card h-20 animate-pulse rounded-xl'} /> : renderStatus()}

        {plans.length > 0 && (
          <div>
            <h3 className={'text-muted-foreground mb-2 px-1 text-xs tracking-wide uppercase'}>
              {t('plansHeading')}
            </h3>
            <div className={'bg-card divide-border divide-y overflow-hidden rounded-xl'}>
              {plans.map((plan) => {
                const active = effectivePlan === plan.code;
                const kopecks = activePlanKopecks(plan.code);
                return (
                  <button
                    key={plan.code}
                    type={'button'}
                    onClick={() => {
                      if (plan.code !== effectivePlan) {
                        setPromoApplied('');
                        setPromoDiscount(0);
                        setPromoFinalKopecks(null);
                        setPromoInput('');
                      }
                      setSelectedPlan(plan.code);
                    }}
                    className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors ${active ? 'bg-primary/5' : 'active:bg-surface-hover'}`}
                  >
                    <div
                      className={`h-5 w-5 shrink-0 rounded-full border-2 transition-colors ${active ? 'border-primary bg-primary' : 'border-border bg-transparent'}`}
                    />
                    <div className={'flex-1'}>
                      <div className={'flex items-center gap-2'}>
                        <span className={'text-foreground text-[15px] font-medium'}>
                          {planLabel(plan)}
                        </span>
                        {isAnnualPlan(plan) && (
                          <span
                            className={
                              'bg-success/15 text-success rounded-full px-2 py-0.5 text-xs font-medium'
                            }
                          >
                            {t('planRecommended')}
                          </span>
                        )}
                      </div>
                      <div className={'text-muted-foreground text-sm'}>
                        {Math.round(kopecks / 100)}
                        {' ₽'}
                        {planPeriodSuffix(plan)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className={'bg-card rounded-xl p-4'}>
          <div className={'flex gap-2'}>
            <input
              type={'text'}
              value={promoInput}
              onChange={(e) => {
                setPromoInput(e.target.value);
                if (promoApplied) {
                  setPromoApplied('');
                  setPromoDiscount(0);
                  setPromoFinalKopecks(null);
                }
              }}
              placeholder={t('promoInputPlaceholder')}
              className={
                'bg-surface-hover text-foreground placeholder:text-muted-foreground flex-1 rounded-lg px-3 py-2 text-sm outline-none'
              }
            />
            <button
              type={'button'}
              onClick={handleApplyPromo}
              disabled={!promoInput.trim() || promoChecking}
              className={
                'bg-surface-hover text-foreground active:bg-border rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50'
              }
            >
              {promoChecking ? t('promoChecking') : t('promoApply')}
            </button>
          </div>
          {promoApplied && promoDiscount > 0 && (
            <p className={'text-success mt-2 text-xs'}>
              {t('promoApplied', { discount: Math.round(promoDiscount / 100) })}
            </p>
          )}
        </div>

        {data?.recurringAvailable && (
          <div className={'bg-card rounded-xl p-4'}>
            <div className={'flex items-center justify-between gap-3'}>
              <div>
                <div className={'text-foreground text-[15px] font-medium'}>
                  {t('autoRenewToggleLabel')}
                </div>
                <div className={'text-muted-foreground text-sm'}>{t('autoRenewToggleHint')}</div>
              </div>
              <Switch
                checked={autoRenew}
                onChange={setAutoRenew}
                ariaLabel={t('autoRenewToggleLabel')}
              />
            </div>
          </div>
        )}

        <button
          type={'button'}
          onClick={handleCheckout}
          disabled={checkingOut || !effectivePlan}
          className={
            'bg-primary text-primary-foreground flex w-full items-center justify-center rounded-xl py-3.5 text-base font-medium transition-opacity active:opacity-80 disabled:opacity-50'
          }
        >
          {checkingOut ? t('checkoutProcessing') : t('checkoutButton')}
        </button>

        {data?.status === 'active' && (
          <div className={'bg-card rounded-xl p-4'}>
            <div className={'text-muted-foreground mb-3 text-sm'}>
              {data.cancelAtPeriodEnd ? t('autoRenewOff') : t('autoRenewOn')}
            </div>
            {data.cancelAtPeriodEnd ? (
              <button
                type={'button'}
                onClick={handleResumeAutoRenew}
                disabled={actioning}
                className={
                  'bg-primary text-primary-foreground flex w-full items-center justify-center rounded-xl py-3 text-sm font-medium transition-opacity active:opacity-80 disabled:opacity-50'
                }
              >
                {t('resumeAutoRenew')}
              </button>
            ) : (
              <button
                type={'button'}
                onClick={() => {
                  setCancelOpen(true);
                }}
                disabled={actioning}
                className={
                  'bg-surface-hover text-muted-foreground active:bg-border flex w-full items-center justify-center rounded-xl py-3 text-sm font-medium transition-colors disabled:opacity-50'
                }
              >
                {t('cancelAutoRenew')}
              </button>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={cancelOpen}
        onClose={() => {
          setCancelOpen(false);
        }}
        onConfirm={handleCancelAutoRenew}
        title={t('cancelConfirmTitle')}
        description={t('cancelConfirmBody')}
        confirmText={t('cancelConfirmButton')}
        destructive
      />
    </div>
  );
}
