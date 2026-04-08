import { Eye } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { dayKeyMap, monthShortCapKeys } from '@/lib/mappings';

import { ServiceSelector } from '../ServiceSelector';
import { DaysOfWeek } from './DaysOfWeek';

import type { TRecurringDayFormProps } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the recurring day form UI and related interactions.
 *
 * Parameters:
 * - props: Component props that drive rendering and callbacks.
 *
 * Returns:
 * - The computed value for the current operation as ReactNode.
 *
 * Side effects:
 * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
 ***************************************************************************************************/
export function RecurringDayForm({
  services,
  recService,
  setRecService,
  activeDay,
  handleDayClick,
  dayTimeMap,
  timeSlotsForActiveDay,
  hasDayTimes,
  selectedPeriod,
  recFormReady,
  setSelectedPeriod,
  isPreviewing,
  handlePreview,
  previewDates,
  handleRecTimeSelect,
}: TRecurringDayFormProps): ReactNode {
  /***************************************************************************************************
   * Defines the t value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const t = useTranslations('BookingForm');
  /***************************************************************************************************
   * Defines the tc value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const tc = useTranslations('Common');
  /***************************************************************************************************
   * Defines the td value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const td = useTranslations('Date');

  /***************************************************************************************************
   * Defines the days value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const DAYS = [
    { label: td('daysShort.mon'), value: 1 },
    { label: td('daysShort.tue'), value: 2 },
    { label: td('daysShort.wed'), value: 3 },
    { label: td('daysShort.thu'), value: 4 },
    { label: td('daysShort.fri'), value: 5 },
    { label: td('daysShort.sat'), value: 6 },
    { label: td('daysShort.sun'), value: 0 },
  ];

  /***************************************************************************************************
   * Defines the periods value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const PERIODS = [
    { label: t('period1week'), value: '1week' },
    { label: t('period1month'), value: '1month' },
    { label: t('period3months'), value: '3months' },
  ];

  /***************************************************************************************************
   * Returns day name short.
   *
   * Parameters:
   * - dayNum: Day num used by the current operation.
   *
   * Returns:
   * - The computed value for the current operation as string.
   *
   * Side effects:
   * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
   ***************************************************************************************************/
  function getDayNameShort(dayNum: number): string {
    /***************************************************************************************************
     * Defines the key value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const key = dayKeyMap[dayNum];
    return key ? td(`daysShort.${key}`) : '?';
  }

  /***************************************************************************************************
   * Formats preview date.
   *
   * Parameters:
   * - dateStr: Date value used by the current operation.
   *
   * Returns:
   * - The computed value for the current operation as string.
   *
   * Side effects:
   * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
   ***************************************************************************************************/
  function formatPreviewDate(dateStr: string): string {
    /***************************************************************************************************
     * Defines the d value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const d = new Date(dateStr);
    /***************************************************************************************************
     * Defines the day name value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const dayName = getDayNameShort(d.getDay());
    /***************************************************************************************************
     * Defines the month key value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const monthKey = monthShortCapKeys[d.getMonth()];
    return `${dayName}, ${d.getDate()} ${td(`monthsShort.${monthKey}`)}`;
  }
  return (
    <div className={'space-y-4'}>
      {/***************************************************************************************************
       * Service.
       ***************************************************************************************************/}
      {services.length > 0 && (
        <div>
          <label className={'text-muted-foreground mb-2 block text-sm'}>{t('service')}</label>
          <ServiceSelector
            services={services}
            selectedId={recService?.id ?? ''}
            onChange={setRecService}
          />
        </div>
      )}

      {/***************************************************************************************************
       * Days of week.
       ***************************************************************************************************/}
      <DaysOfWeek
        activeDay={activeDay}
        handleDayClick={handleDayClick}
        dayTimeMap={dayTimeMap}
        DAYS={DAYS}
      />

      {/***************************************************************************************************
       * Time slots for active day.
       ***************************************************************************************************/}
      {recService && activeDay !== null && (
        <div>
          <label className={'text-muted-foreground mb-2 block text-sm'}>
            {t('timeForDay', { day: getDayNameShort(activeDay) })}
          </label>
          {timeSlotsForActiveDay.length > 0 ? (
            <div className={'grid grid-cols-4 gap-2'}>
              {timeSlotsForActiveDay.map((slot) => (
                <button
                  key={slot}
                  onClick={() => handleRecTimeSelect(slot)}
                  className={`rounded-lg py-2.5 text-sm font-medium transition-colors ${
                    dayTimeMap[activeDay] === slot
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card text-foreground'
                  }`}
                >
                  {slot}
                </button>
              ))}
            </div>
          ) : (
            <p className={'text-muted-foreground text-sm'}>
              {t('noSlotsForDay', { day: getDayNameShort(activeDay) })}
            </p>
          )}
        </div>
      )}

      {/***************************************************************************************************
       * Configured days summary.
       ***************************************************************************************************/}
      {hasDayTimes && activeDay === null && (
        <div className={'space-y-1'}>
          {DAYS.filter((d) => d.value in dayTimeMap).map((d) => (
            <div key={d.value} className={'flex items-center justify-between px-1 text-sm'}>
              <span className={'text-foreground'}>{d.label}</span>
              <span className={'text-muted-foreground'}>{dayTimeMap[d.value]}</span>
            </div>
          ))}
        </div>
      )}

      {/***************************************************************************************************
       * Period.
       ***************************************************************************************************/}
      {recService && hasDayTimes && (
        <div>
          <label className={'text-muted-foreground mb-2 block text-sm'}>{t('period')}</label>
          <div className={'flex gap-2'}>
            {PERIODS.map((period) => (
              <button
                key={period.value}
                onClick={() => setSelectedPeriod(period.value)}
                className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                  selectedPeriod === period.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-foreground'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/***************************************************************************************************
       * Preview & Submit.
       ***************************************************************************************************/}
      {recFormReady && (
        <div className={'space-y-2'}>
          {!previewDates && (
            <button
              onClick={handlePreview}
              disabled={isPreviewing}
              className={
                'bg-card text-foreground flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-opacity active:opacity-70 disabled:opacity-40'
              }
            >
              <Eye className={'h-4 w-4'} />
              {isPreviewing ? tc('loading') : t('preview')}
            </button>
          )}

          {previewDates && (
            <div>
              <label className={'text-muted-foreground mb-2 block text-sm'}>
                {t('previewCount', { count: previewDates.length })}
              </label>
              <div className={'bg-card max-h-40 space-y-1 overflow-y-auto rounded-lg p-3'}>
                {previewDates.map((date) => (
                  <div key={date} className={'text-foreground text-sm'}>
                    {formatPreviewDate(date)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
