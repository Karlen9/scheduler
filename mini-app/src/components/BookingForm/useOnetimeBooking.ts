'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { invalidateBookings } from '@/hooks/mutations';
import { api } from '@/lib/api';
import { ProRequiredError } from '@/lib/api/shared';
import { formatDateISO } from '@/lib/helpers';
import { monthGenKeys } from '@/lib/mappings';
import { resolveTestAwareHref } from '@/lib/routes';

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
  bookedDates,
  clientBatches,
  selectedClient,
  hasClientSelector,
  onCreateBooking,
  successRedirect,
  initialDate,
  initialService,
  initialTime,
  initialComment,
}: TUseOnetimeBookingParams): TUseOnetimeBookingReturn {
  /***************************************************************************************************
   * Defines the router value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
  const [disabledDates, setDisabledDates] = useState<string[]>([]);
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
  const todayAvailabilityRequestIdRef = useRef(0);
  const bookedDatesSet = useMemo(() => new Set(bookedDates ?? []), [bookedDates]);
  const selectedServiceActiveBatch = useMemo(() => {
    if (selectedService?.type !== 'batch') {
      return null;
    }
    return (
      clientBatches?.find(
        (batch) =>
          batch.serviceId === selectedService.id &&
          batch.status === 'active' &&
          batch.remainingSessions > 0,
      ) ?? null
    );
  }, [clientBatches, selectedService]);
  const todayISO = useMemo(() => formatDateISO(new Date()), []);

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

  const appliedInitialServiceKeyRef = useRef<string | null>(null);
  const appliedInitialDateKeyRef = useRef<string | null>(null);
  const appliedInitialTimeRef = useRef<string | null>(null);
  const appliedInitialCommentRef = useRef<string | null>(null);

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

  useEffect(() => {
    const duration = selectedService?.durationMinutes;
    if (!duration) {
      todayAvailabilityRequestIdRef.current += 1;
      setDisabledDates([]);
      return;
    }

    const requestId = todayAvailabilityRequestIdRef.current + 1;
    todayAvailabilityRequestIdRef.current = requestId;

    api
      .getAvailableSlots(todayISO, duration)
      .then((slots) => {
        if (requestId !== todayAvailabilityRequestIdRef.current) {
          return;
        }
        setDisabledDates(slots.some((slot) => slot.available) ? [] : [todayISO]);
      })
      .catch((err) => {
        if (requestId !== todayAvailabilityRequestIdRef.current) {
          return;
        }
        console.error('Failed to load today availability:', err);
        setDisabledDates([]);
      });
  }, [selectedService?.durationMinutes, todayISO]);

  /***************************************************************************************************
   * Apply initialService on mount (or when it changes). Ref-gated by service id so that if the
   * user subsequently edits the service the effect does not clobber their manual choice.
   ***************************************************************************************************/
  useEffect(() => {
    if (!initialService) {
      return;
    }
    if (appliedInitialServiceKeyRef.current === initialService.id) {
      return;
    }
    if (selectedService?.id === initialService.id) {
      appliedInitialServiceKeyRef.current = initialService.id;
      return;
    }
    appliedInitialServiceKeyRef.current = initialService.id;
    applyServiceSelection(initialService);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialService]);

  /***************************************************************************************************
   * Apply initialDate after a service has been chosen. Service selection resets selectedDate
   * (see handleServiceSelect), so doing this on mount would be clobbered; gating on
   * selectedService ensures the preselected date survives into the date-picker stage.
   * The ref key is the formatted date string, so repeat navigations with a different date
   * re-apply (admin clicks a second empty slot before leaving the page), while the same
   * date won't re-apply after a service change and wipe the user's in-progress picks.
   ***************************************************************************************************/
  useEffect(() => {
    if (!initialDate || !selectedService) {
      return;
    }
    const key = formatDateISO(initialDate);
    if (appliedInitialDateKeyRef.current === key) {
      return;
    }
    if (selectedDate && formatDateISO(selectedDate) === key) {
      appliedInitialDateKeyRef.current = key;
      return;
    }
    appliedInitialDateKeyRef.current = key;
    setMode('single');
    setSelectedDate(initialDate);
    fetchSlots(initialDate, selectedService.durationMinutes);
  }, [initialDate, selectedService, selectedDate, fetchSlots]);

  /***************************************************************************************************
   * Apply initialTime once both service and date are in place. Gated by ref + state-match so
   * URL rewrites from user picks don't cause redundant re-applies.
   ***************************************************************************************************/
  useEffect(() => {
    if (!initialTime || !selectedService || !selectedDate) {
      return;
    }
    if (appliedInitialTimeRef.current === initialTime) {
      return;
    }
    if (selectedTime === initialTime) {
      appliedInitialTimeRef.current = initialTime;
      return;
    }
    appliedInitialTimeRef.current = initialTime;
    setSelectedTime(initialTime);
  }, [initialTime, selectedService, selectedDate, selectedTime]);

  /***************************************************************************************************
   * Apply initialComment once on mount (ref-gated). Runs independently of other selections so a
   * deep-link with just ?comment= still seeds the textarea.
   ***************************************************************************************************/
  useEffect(() => {
    if (!initialComment) {
      return;
    }
    if (appliedInitialCommentRef.current === initialComment) {
      return;
    }
    if (message === initialComment) {
      appliedInitialCommentRef.current = initialComment;
      return;
    }
    appliedInitialCommentRef.current = initialComment;
    setMessage(initialComment);
  }, [initialComment, message]);

  /***************************************************************************************************
   * Sync search params for the single-mode flow so selections are reflected in the URL.
   * Uses router.replace to avoid bloating history; preserves unrelated params (e.g. clientId).
   ***************************************************************************************************/
  /***************************************************************************************************
   * A single object-shape payload avoids positional-arg ordering mistakes when callers add a new
   * field. Every field is required (falsy = unset) so the URL always reflects the full flow state.
   ***************************************************************************************************/
  type TSingleUrlState = {
    service: TSessionType | null;
    date: Date | null;
    time: string | null;
    comment: string;
  };

  const syncSingleUrl = useCallback(
    ({ service, date, time, comment }: TSingleUrlState): void => {
      const next = new URLSearchParams();
      for (const [key, value] of searchParams.entries()) {
        if (key !== 'service' && key !== 'date' && key !== 'time' && key !== 'comment') {
          next.append(key, value);
        }
      }
      if (service) {
        next.set('service', service.id);
      }
      if (date) {
        next.set('date', formatDateISO(date));
      }
      if (time) {
        next.set('time', time);
      }
      if (comment) {
        next.set('comment', comment);
      }
      const desired = next.toString();
      if (searchParams.toString() === desired) {
        return;
      }
      router.replace(`${pathname}${desired ? `?${desired}` : ''}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );
  /***************************************************************************************************
   * Ref mirror so effects can call the latest syncSingleUrl without re-running on every URL change
   * (syncSingleUrl's identity changes whenever searchParams does).
   ***************************************************************************************************/
  const syncSingleUrlRef = useRef(syncSingleUrl);
  syncSingleUrlRef.current = syncSingleUrl;

  useEffect(() => {
    if (!disabledDates.includes(todayISO)) {
      return;
    }

    if (selectedDate && formatDateISO(selectedDate) === todayISO) {
      slotsRequestIdRef.current += 1;
      setSelectedDate(null);
      setSelectedTime(null);
      setTimeSlots([]);
      setNoSlotsAvailable(false);
      syncSingleUrlRef.current({
        service: selectedService,
        date: null,
        time: null,
        comment: message,
      });
    }

    if (selectedDates.some((date) => formatDateISO(date) === todayISO)) {
      setSelectedDates((prev) => prev.filter((date) => formatDateISO(date) !== todayISO));
      setTimeAssignments((prev) => {
        const next = { ...prev };
        delete next[todayISO];
        return next;
      });
      if (activeDateISO === todayISO) {
        setActiveDateISO(null);
        setTimeSlots([]);
        setNoSlotsAvailable(false);
      }
    }
  }, [
    activeDateISO,
    disabledDates,
    message,
    selectedDate,
    selectedDates,
    selectedService,
    todayISO,
  ]);

  /***************************************************************************************************
   * Debounced comment-to-URL sync. Comment edits fire on every keystroke, so batching avoids an
   * explosion of router.replace calls while still restoring on reload.
   ***************************************************************************************************/
  const commentSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (commentSyncTimerRef.current) {
        clearTimeout(commentSyncTimerRef.current);
      }
    };
  }, []);

  /***************************************************************************************************
   * If the selected time isn't available in the currently loaded slots (e.g. user changed the day
   * and the same clock time isn't offered or is booked), clear it so the UI and URL stay honest.
   ***************************************************************************************************/
  useEffect(() => {
    if (!selectedTime || isLoadingSlots || timeSlots.length === 0) {
      return;
    }
    const isValid = timeSlots.some((s) => s.time === selectedTime && s.available);
    if (isValid) {
      return;
    }
    setSelectedTime(null);
    syncSingleUrlRef.current({
      service: selectedService,
      date: selectedDate,
      time: null,
      comment: message,
    });
  }, [timeSlots, selectedTime, isLoadingSlots, selectedService, selectedDate, message]);

  /***************************************************************************************************
   * Service handlers.
   *
   * Internal worker sets state without touching the URL — used by the initial-apply effect so
   * that seeding state from incoming search params doesn't clobber the other params.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const applyServiceSelection = (service: TSessionType): boolean => {
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
    return changed;
  };

  const handleServiceSelect = (service: TSessionType): void => {
    const changed = applyServiceSelection(service);
    syncSingleUrl({
      service,
      date: changed ? null : selectedDate,
      time: changed ? null : selectedTime,
      comment: message,
    });
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
    setDisabledDates([]);
    setMessage('');
    if (commentSyncTimerRef.current) {
      clearTimeout(commentSyncTimerRef.current);
      commentSyncTimerRef.current = null;
    }
    syncSingleUrl({ service: null, date: null, time: null, comment: '' });
  };

  /***************************************************************************************************
   * Single mode handlers.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleSingleDateSelect = (date: Date): void => {
    setSelectedDate(date);
    if (selectedService) {
      fetchSlots(date, selectedService.durationMinutes);
    }
    syncSingleUrl({ service: selectedService, date, time: selectedTime, comment: message });
  };

  /***************************************************************************************************
   * Handles single time select.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleSingleTimeSelect = (time: string): void => {
    setSelectedTime(time);
    syncSingleUrl({ service: selectedService, date: selectedDate, time, comment: message });
  };

  /***************************************************************************************************
   * Wraps setMessage so keystrokes also reflect into the URL (?comment=), debounced so a long
   * comment doesn't trigger a router.replace per character.
   ***************************************************************************************************/
  const handleMessageChange = (value: string): void => {
    setMessage(value);
    if (commentSyncTimerRef.current) {
      clearTimeout(commentSyncTimerRef.current);
    }
    commentSyncTimerRef.current = setTimeout(() => {
      syncSingleUrlRef.current({
        service: selectedService,
        date: selectedDate,
        time: selectedTime,
        comment: value,
      });
      commentSyncTimerRef.current = null;
    }, 200);
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
    const isAutoConfirmed = !!(selectedClient?.isGhost || selectedClient?.isSelf);
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
      const suffix = isAutoConfirmed ? '' : t('successAwaitConfirmation');
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
      const confirm = isAutoConfirmed ? '' : t('successAwaitConfirmation');
      return `${t('successMultiCount', { count: selectedDates.length })}${multiFor}.${confirm}`;
    }
    return isAutoConfirmed ? t('successBookingCreated') : t('successAwaitConfirmation');
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
        sessionTypeId: selectedService.id,
        duration: selectedService.durationMinutes,
        date: dateStr,
        time: selectedTime,
        message: message || undefined,
      });
      invalidateBookings();
      toast.success(t('successTitle'), { description: getOnetimeSuccessDescription() });
      router.push(resolveTestAwareHref(pathname, successRedirect));
    } catch (err) {
      /***************************************************************************************************
       * Defines the msg value used by the component layer.
       *
       * Usage context:
       * - Reused by the component layer to keep shared values centralized.
       ***************************************************************************************************/
      if (err instanceof ProRequiredError) {
        toast.error(te('proRequiredBooking'));
      } else {
        const msg = err instanceof Error ? err.message : te('bookingCreateFailed');
        toast.error(msg);
      }
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
          sessionTypeId: selectedService.id,
          duration: selectedService.durationMinutes,
          date: iso,
          time,
          message: message || undefined,
        });
      }
      invalidateBookings();
      toast.success(t('successTitle'), { description: getOnetimeSuccessDescription() });
      router.push(resolveTestAwareHref(pathname, successRedirect));
    } catch (err) {
      /***************************************************************************************************
       * Defines the msg value used by the component layer.
       *
       * Usage context:
       * - Reused by the component layer to keep shared values centralized.
       ***************************************************************************************************/
      if (err instanceof ProRequiredError) {
        toast.error(te('proRequiredBooking'));
      } else {
        const msg = err instanceof Error ? err.message : te('bookingCreateFailed');
        toast.error(msg);
      }
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
    if (selectedService.type === 'batch' && !selectedServiceActiveBatch && !hasClientSelector) {
      return { text: t('btnNoBatch'), disabled: true };
    }
    if (mode === 'single') {
      if (!selectedDate) {
        return { text: t('btnSelectDate'), disabled: true };
      }
      if (bookedDatesSet.has(formatDateISO(selectedDate))) {
        return { text: t('btnSubmit'), disabled: true };
      }
      if (!selectedTime) {
        return { text: t('btnSelectTime'), disabled: true };
      }
      return { text: isSubmitting ? tc('sending') : t('btnSubmit'), disabled: isSubmitting };
    }
    if (selectedDates.length === 0) {
      return { text: t('btnSelectDays'), disabled: true };
    }
    if (
      selectedService.type === 'batch' &&
      selectedServiceActiveBatch &&
      selectedDates.length > selectedServiceActiveBatch.remainingSessions &&
      !hasClientSelector
    ) {
      return { text: t('btnNoBatch'), disabled: true };
    }
    if (selectedDates.some((d) => bookedDatesSet.has(formatDateISO(d)))) {
      return { text: t('btnSubmit'), disabled: true };
    }
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
    disabledDates,
    isLoadingSlots,
    message,
    setMessage: handleMessageChange,
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
