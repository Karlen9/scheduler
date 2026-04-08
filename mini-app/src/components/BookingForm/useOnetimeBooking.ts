'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { invalidateBookings } from '@/hooks/mutations';
import { api } from '@/lib/api';
import { formatDateISO } from '@/lib/helpers';
import { monthGenKeys } from '@/lib/mappings';

import type {
  TSessionType,
  TTimeSlot,
  TUseOnetimeBookingParams,
  TUseOnetimeBookingReturn,
} from '@/lib/types';

/***************************************************************************************************
 * Loads and exposes onetime booking data for consuming components.
 *
 * Parameters:
 * - props: Component props that drive rendering and callbacks.
 *
 * Returns:
 * - The computed value for the current operation as TUseOnetimeBookingReturn.
 *
 * Side effects:
 * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
 ***************************************************************************************************/
export function useOnetimeBooking({
  services,
  selectedClient,
  hasClientSelector,
  onCreateBooking,
  successRedirect,
}: TUseOnetimeBookingParams): TUseOnetimeBookingReturn {
  /***************************************************************************************************
   * Defines the router value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const router = useRouter();
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
  const td = useTranslations('Dates');
  /***************************************************************************************************
   * Defines the te value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const te = useTranslations('Errors');

  /***************************************************************************************************
   * State.
   ***************************************************************************************************/
  const [mode, setMode] = useState<'single' | 'multi'>('single');
  const [selectedService, setSelectedService] = useState<TSessionType | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [activeDateISO, setActiveDateISO] = useState<string | null>(null);
  const [timeAssignments, setTimeAssignments] = useState<Record<string, string>>({});
  const [timeSlots, setTimeSlots] = useState<TTimeSlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [, setNoSlotsAvailable] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  /***************************************************************************************************
   * Defines the slots request id ref value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const slotsRequestIdRef = useRef(0);

  /***************************************************************************************************
   * Auto-select first service when only one exists.
   ***************************************************************************************************/
  useEffect(() => {
    if (services.length === 1 && !selectedService) {
      setSelectedService(services[0]);
    }
  }, [services]); // eslint-disable-line react-hooks/exhaustive-deps

  /***************************************************************************************************
   * Reset selections when mode changes.
   ***************************************************************************************************/
  useEffect(() => {
    slotsRequestIdRef.current += 1;
    setSelectedDate(null);
    setSelectedTime(null);
    setSelectedDates([]);
    setActiveDateISO(null);
    setTimeAssignments({});
    setTimeSlots([]);
    setNoSlotsAvailable(false);
    setMessage('');
  }, [mode]);

  /***************************************************************************************************
   * Helpers.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const fetchSlots = useCallback(async (date: Date, duration: number): Promise<void> => {
    if (!duration) {
      return;
    }
    /***************************************************************************************************
     * Defines the request id value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const requestId = slotsRequestIdRef.current + 1;
    slotsRequestIdRef.current = requestId;
    setIsLoadingSlots(true);
    try {
      /***************************************************************************************************
       * Defines the date str value used by the component layer.
       *
       * Usage context:
       * - Reused by the component layer to keep shared values centralized.
       ***************************************************************************************************/
      const dateStr = formatDateISO(date);
      /***************************************************************************************************
       * Defines the slots value used by the component layer.
       *
       * Usage context:
       * - Reused by the component layer to keep shared values centralized.
       ***************************************************************************************************/
      const slots = await api.getAvailableSlots(dateStr, duration);
      if (requestId !== slotsRequestIdRef.current) {
        return;
      }
      setTimeSlots(slots);
      /***************************************************************************************************
       * Defines the has available value used by the component layer.
       *
       * Usage context:
       * - Reused by the component layer to keep shared values centralized.
       ***************************************************************************************************/
      const hasAvailable = slots.some((s) => s.available);
      setNoSlotsAvailable(!hasAvailable);
    } catch (err) {
      if (requestId !== slotsRequestIdRef.current) {
        return;
      }
      console.error('Failed to load time slots:', err);
      setTimeSlots([]);
      setNoSlotsAvailable(true);
    } finally {
      if (requestId === slotsRequestIdRef.current) {
        setIsLoadingSlots(false);
      }
    }
  }, []);

  /***************************************************************************************************
   * Service handlers.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleServiceSelect = (service: TSessionType): void => {
    /***************************************************************************************************
     * Defines the changed value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const changed = selectedService?.id !== service.id;
    setSelectedService(service);
    if (changed) {
      slotsRequestIdRef.current += 1;
      setSelectedDate(null);
      setSelectedTime(null);
      setSelectedDates([]);
      setActiveDateISO(null);
      setTimeAssignments({});
      setTimeSlots([]);
      setNoSlotsAvailable(false);
    }
  };

  /***************************************************************************************************
   * Handles edit service.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleEditService = (): void => {
    slotsRequestIdRef.current += 1;
    setSelectedService(null);
    setSelectedDate(null);
    setSelectedTime(null);
    setSelectedDates([]);
    setActiveDateISO(null);
    setTimeAssignments({});
    setTimeSlots([]);
    setNoSlotsAvailable(false);
  };

  /***************************************************************************************************
   * Single mode handlers.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleSingleDateSelect = (date: Date): void => {
    setSelectedDate(date);
    setSelectedTime(null);
    if (selectedService) {
      fetchSlots(date, selectedService.durationMinutes);
    }
  };

  /***************************************************************************************************
   * Handles single time select.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleSingleTimeSelect = (time: string): void => {
    setSelectedTime(time);
  };

  /***************************************************************************************************
   * Multi mode handlers.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleMultiDateToggle = (date: Date): void => {
    /***************************************************************************************************
     * Defines the iso value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const iso = formatDateISO(date);
    /***************************************************************************************************
     * Defines the exists value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const exists = selectedDates.some((d) => formatDateISO(d) === iso);

    if (exists) {
      /***************************************************************************************************
       * Defines the new dates value used by the component layer.
       *
       * Usage context:
       * - Reused by the component layer to keep shared values centralized.
       ***************************************************************************************************/
      const newDates = selectedDates.filter((d) => formatDateISO(d) !== iso);
      setSelectedDates(newDates);
      setTimeAssignments((prev) => {
        /***************************************************************************************************
         * Defines the next value used by the component layer.
         *
         * Usage context:
         * - Reused by the component layer to keep shared values centralized.
         ***************************************************************************************************/
        const next = { ...prev };
        delete next[iso];
        return next;
      });
      if (activeDateISO === iso) {
        if (newDates.length > 0) {
          /***************************************************************************************************
           * Defines the first iso value used by the component layer.
           *
           * Usage context:
           * - Reused by the component layer to keep shared values centralized.
           ***************************************************************************************************/
          const firstISO = formatDateISO(newDates[0]);
          setActiveDateISO(firstISO);
          if (selectedService) {
            fetchSlots(newDates[0], selectedService.durationMinutes);
          }
        } else {
          setActiveDateISO(null);
          setTimeSlots([]);
          setNoSlotsAvailable(false);
        }
      }
    } else {
      if (selectedDates.length >= 6) {
        return;
      }
      /***************************************************************************************************
       * Defines the new dates value used by the component layer.
       *
       * Usage context:
       * - Reused by the component layer to keep shared values centralized.
       ***************************************************************************************************/
      const newDates = [...selectedDates, date].sort((a, b) => a.getTime() - b.getTime());
      setSelectedDates(newDates);
      setActiveDateISO(iso);
      if (selectedService) {
        fetchSlots(date, selectedService.durationMinutes);
      }
    }
  };

  /***************************************************************************************************
   * Handles chip tap.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleChipTap = (date: Date): void => {
    /***************************************************************************************************
     * Defines the iso value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const iso = formatDateISO(date);
    setActiveDateISO(iso);
    if (selectedService) {
      fetchSlots(date, selectedService.durationMinutes);
    }
  };

  /***************************************************************************************************
   * Handles multi time select.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleMultiTimeSelect = (time: string): void => {
    if (!activeDateISO || !selectedService) {
      return;
    }
    /***************************************************************************************************
     * Defines the new assignments value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const newAssignments = { ...timeAssignments, [activeDateISO]: time };
    setTimeAssignments(newAssignments);

    /***************************************************************************************************
     * Defines the current index value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const currentIndex = selectedDates.findIndex((d) => formatDateISO(d) === activeDateISO);
    for (let i = currentIndex + 1; i < selectedDates.length; i++) {
      /***************************************************************************************************
       * Defines the iso value used by the component layer.
       *
       * Usage context:
       * - Reused by the component layer to keep shared values centralized.
       ***************************************************************************************************/
      const iso = formatDateISO(selectedDates[i]);
      if (!newAssignments[iso]) {
        setActiveDateISO(iso);
        fetchSlots(selectedDates[i], selectedService.durationMinutes);
        return;
      }
    }
    for (let i = 0; i < currentIndex; i++) {
      /***************************************************************************************************
       * Defines the iso value used by the component layer.
       *
       * Usage context:
       * - Reused by the component layer to keep shared values centralized.
       ***************************************************************************************************/
      const iso = formatDateISO(selectedDates[i]);
      if (!newAssignments[iso]) {
        setActiveDateISO(iso);
        fetchSlots(selectedDates[i], selectedService.durationMinutes);
        return;
      }
    }
  };

  /***************************************************************************************************
   * Submit.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const getOnetimeSuccessDescription = (): string => {
    /***************************************************************************************************
     * Defines the is ghost value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const isGhost = selectedClient?.isGhost;
    if (mode === 'single' && selectedDate && selectedTime && selectedService) {
      /***************************************************************************************************
       * Defines the who value used by the component layer.
       *
       * Usage context:
       * - Reused by the component layer to keep shared values centralized.
       ***************************************************************************************************/
      const who = selectedClient
        ? t('successClientBooked', { name: selectedClient.displayName || selectedClient.name })
        : t('successYouAreBooked');
      /***************************************************************************************************
       * Defines the month key value used by the component layer.
       *
       * Usage context:
       * - Reused by the component layer to keep shared values centralized.
       ***************************************************************************************************/
      const monthKey = monthGenKeys[selectedDate.getMonth()];
      /***************************************************************************************************
       * Defines the suffix value used by the component layer.
       *
       * Usage context:
       * - Reused by the component layer to keep shared values centralized.
       ***************************************************************************************************/
      const suffix = isGhost ? '' : t('successAwaitConfirmation');
      return t('successBookedAt', {
        who,
        date: selectedDate.getDate(),
        month: td(`monthsGen.${monthKey}`),
        time: selectedTime,
        service: selectedService.name,
        suffix,
      });
    }
    if (mode === 'multi') {
      /***************************************************************************************************
       * Defines the multi for value used by the component layer.
       *
       * Usage context:
       * - Reused by the component layer to keep shared values centralized.
       ***************************************************************************************************/
      const multiFor = selectedClient
        ? t('successMultiFor', { name: selectedClient.displayName || selectedClient.name })
        : '';
      /***************************************************************************************************
       * Defines the confirm value used by the component layer.
       *
       * Usage context:
       * - Reused by the component layer to keep shared values centralized.
       ***************************************************************************************************/
      const confirm = isGhost ? '' : t('successAwaitConfirmation');
      return `${t('successMultiCount', { count: selectedDates.length })}${multiFor}.${confirm}`;
    }
    return isGhost ? t('successBookingCreated') : t('successAwaitConfirmation');
  };

  /***************************************************************************************************
   * Handles single submit.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleSingleSubmit = async (): Promise<void> => {
    if (!selectedDate || !selectedTime || !selectedService) {
      return;
    }
    if (hasClientSelector && !selectedClient) {
      return;
    }
    setIsSubmitting(true);
    try {
      /***************************************************************************************************
       * Defines the date str value used by the component layer.
       *
       * Usage context:
       * - Reused by the component layer to keep shared values centralized.
       ***************************************************************************************************/
      const dateStr = formatDateISO(selectedDate);
      await onCreateBooking({
        clientId: selectedClient?.id,
        duration: selectedService.durationMinutes,
        date: dateStr,
        time: selectedTime,
        message: message || undefined,
      });
      invalidateBookings();
      toast.success(t('successTitle'), { description: getOnetimeSuccessDescription() });
      router.push(successRedirect);
    } catch (err) {
      /***************************************************************************************************
       * Defines the msg value used by the component layer.
       *
       * Usage context:
       * - Reused by the component layer to keep shared values centralized.
       ***************************************************************************************************/
      const msg = err instanceof Error ? err.message : te('bookingCreateFailed');
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  /***************************************************************************************************
   * Handles multi submit.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleMultiSubmit = async (): Promise<void> => {
    if (!selectedService) {
      return;
    }
    if (hasClientSelector && !selectedClient) {
      return;
    }
    setIsSubmitting(true);
    try {
      for (const date of selectedDates) {
        /***************************************************************************************************
         * Defines the iso value used by the component layer.
         *
         * Usage context:
         * - Reused by the component layer to keep shared values centralized.
         ***************************************************************************************************/
        const iso = formatDateISO(date);
        /***************************************************************************************************
         * Defines the time value used by the component layer.
         *
         * Usage context:
         * - Reused by the component layer to keep shared values centralized.
         ***************************************************************************************************/
        const time = timeAssignments[iso];
        if (!time) {
          continue;
        }
        await onCreateBooking({
          clientId: selectedClient?.id,
          duration: selectedService.durationMinutes,
          date: iso,
          time,
          message: message || undefined,
        });
      }
      invalidateBookings();
      toast.success(t('successTitle'), { description: getOnetimeSuccessDescription() });
      router.push(successRedirect);
    } catch (err) {
      /***************************************************************************************************
       * Defines the msg value used by the component layer.
       *
       * Usage context:
       * - Reused by the component layer to keep shared values centralized.
       ***************************************************************************************************/
      const msg = err instanceof Error ? err.message : te('bookingCreateFailed');
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  /***************************************************************************************************
   * Handles onetime submit.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleOnetimeSubmit = (): void => {
    if (mode === 'single') {
      handleSingleSubmit();
    } else {
      handleMultiSubmit();
    }
  };

  /***************************************************************************************************
   * Button state.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const getOnetimeButtonState = (): { text: string; disabled: boolean } => {
    if (hasClientSelector && !selectedClient) {
      return { text: t('btnSelectClient'), disabled: true };
    }
    if (!selectedService) {
      return { text: t('btnSelectService'), disabled: true };
    }
    if (mode === 'single') {
      if (!selectedDate) {
        return { text: t('btnSelectDate'), disabled: true };
      }
      if (!selectedTime) {
        return { text: t('btnSelectTime'), disabled: true };
      }
      return { text: isSubmitting ? tc('sending') : t('btnSubmit'), disabled: isSubmitting };
    }
    if (selectedDates.length === 0) {
      return { text: t('btnSelectDays'), disabled: true };
    }
    /***************************************************************************************************
     * Defines the all assigned value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const allAssigned = selectedDates.every((d) => timeAssignments[formatDateISO(d)]);
    if (!allAssigned) {
      return { text: t('btnSelectTime'), disabled: true };
    }
    return { text: isSubmitting ? tc('sending') : t('btnSubmit'), disabled: isSubmitting };
  };

  const { text: onetimeButtonText, disabled: onetimeButtonDisabled } = getOnetimeButtonState();
  /***************************************************************************************************
   * Defines the multi active time value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const multiActiveTime = activeDateISO ? (timeAssignments[activeDateISO] ?? null) : null;

  return {
    mode,
    setMode,
    selectedService,
    selectedDate,
    selectedTime,
    selectedDates,
    activeDateISO,
    timeAssignments,
    timeSlots,
    isLoadingSlots,
    message,
    setMessage,
    multiActiveTime,
    onetimeButtonText,
    onetimeButtonDisabled,
    handleServiceSelect,
    handleEditService,
    handleSingleDateSelect,
    handleSingleTimeSelect,
    handleMultiDateToggle,
    handleChipTap,
    handleMultiTimeSelect,
    handleOnetimeSubmit,
  };
}
