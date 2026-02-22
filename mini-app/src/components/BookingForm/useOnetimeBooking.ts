'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { invalidateBookings } from '@/hooks/mutations';
import { api } from '@/lib/api';
import { formatDateISO } from '@/lib/helpers';
import { monthGenKeys } from '@/lib/mappings';

import type {
  TClientInfo,
  TCreateBookingParams,
  TSessionType,
  TTimeSlot,
  TVoidFunction,
} from '@/lib/types';

type TUseOnetimeBookingParams = {
  services: TSessionType[];
  selectedClient: TClientInfo | null;
  hasClientSelector: boolean;
  onCreateBooking: (params: TCreateBookingParams) => Promise<void>;
  successRedirect: string;
};

type TUseOnetimeBookingReturn = {
  mode: 'single' | 'multi';
  setMode: (mode: 'single' | 'multi') => void;
  selectedService: TSessionType | null;
  selectedDate: Date | null;
  selectedTime: string | null;
  selectedDates: Date[];
  activeDateISO: string | null;
  timeAssignments: Record<string, string>;
  timeSlots: TTimeSlot[];
  isLoadingSlots: boolean;
  message: string;
  setMessage: (message: string) => void;
  multiActiveTime: string | null;
  onetimeButtonText: string;
  onetimeButtonDisabled: boolean;
  handleServiceSelect: (service: TSessionType) => void;
  handleEditService: TVoidFunction;
  handleSingleDateSelect: (date: Date) => void;
  handleSingleTimeSelect: (time: string) => void;
  handleMultiDateToggle: (date: Date) => void;
  handleChipTap: (date: Date) => void;
  handleMultiTimeSelect: (time: string) => void;
  handleOnetimeSubmit: TVoidFunction;
};

export function useOnetimeBooking({
  services,
  selectedClient,
  hasClientSelector,
  onCreateBooking,
  successRedirect,
}: TUseOnetimeBookingParams): TUseOnetimeBookingReturn {
  const router = useRouter();
  const t = useTranslations('BookingForm');
  const tc = useTranslations('Common');
  const td = useTranslations('Dates');
  const te = useTranslations('Errors');

  // ── State ──
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

  // Auto-select first service when only one exists
  useEffect(() => {
    if (services.length === 1 && !selectedService) {
      setSelectedService(services[0]);
    }
  }, [services]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset selections when mode changes
  useEffect(() => {
    setSelectedDate(null);
    setSelectedTime(null);
    setSelectedDates([]);
    setActiveDateISO(null);
    setTimeAssignments({});
    setTimeSlots([]);
    setNoSlotsAvailable(false);
    setMessage('');
  }, [mode]);

  // ── Helpers ──

  const fetchSlots = useCallback(async (date: Date, duration: number): Promise<void> => {
    if (!duration) {
      return;
    }
    setIsLoadingSlots(true);
    try {
      const dateStr = formatDateISO(date);
      const slots = await api.getAvailableSlots(dateStr, duration);
      setTimeSlots(slots);
      const hasAvailable = slots.some((s) => s.available);
      setNoSlotsAvailable(!hasAvailable);
    } catch (err) {
      console.error('Failed to load time slots:', err);
      setTimeSlots([]);
      setNoSlotsAvailable(true);
    } finally {
      setIsLoadingSlots(false);
    }
  }, []);

  // ── Service handlers ──

  const handleServiceSelect = (service: TSessionType): void => {
    const changed = selectedService?.id !== service.id;
    setSelectedService(service);
    if (changed) {
      setSelectedDate(null);
      setSelectedTime(null);
      setSelectedDates([]);
      setActiveDateISO(null);
      setTimeAssignments({});
      setTimeSlots([]);
      setNoSlotsAvailable(false);
    }
  };

  const handleEditService = (): void => {
    setSelectedService(null);
    setSelectedDate(null);
    setSelectedTime(null);
    setSelectedDates([]);
    setActiveDateISO(null);
    setTimeAssignments({});
    setTimeSlots([]);
    setNoSlotsAvailable(false);
  };

  // ── Single mode handlers ──

  const handleSingleDateSelect = (date: Date): void => {
    setSelectedDate(date);
    setSelectedTime(null);
    if (selectedService) {
      fetchSlots(date, selectedService.durationMinutes);
    }
  };

  const handleSingleTimeSelect = (time: string): void => {
    setSelectedTime(time);
  };

  // ── Multi mode handlers ──

  const handleMultiDateToggle = (date: Date): void => {
    const iso = formatDateISO(date);
    const exists = selectedDates.some((d) => formatDateISO(d) === iso);

    if (exists) {
      const newDates = selectedDates.filter((d) => formatDateISO(d) !== iso);
      setSelectedDates(newDates);
      setTimeAssignments((prev) => {
        const next = { ...prev };
        delete next[iso];
        return next;
      });
      if (activeDateISO === iso) {
        if (newDates.length > 0) {
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
      const newDates = [...selectedDates, date].sort((a, b) => a.getTime() - b.getTime());
      setSelectedDates(newDates);
      setActiveDateISO(iso);
      if (selectedService) {
        fetchSlots(date, selectedService.durationMinutes);
      }
    }
  };

  const handleChipTap = (date: Date): void => {
    const iso = formatDateISO(date);
    setActiveDateISO(iso);
    if (selectedService) {
      fetchSlots(date, selectedService.durationMinutes);
    }
  };

  const handleMultiTimeSelect = (time: string): void => {
    if (!activeDateISO || !selectedService) {
      return;
    }
    const newAssignments = { ...timeAssignments, [activeDateISO]: time };
    setTimeAssignments(newAssignments);

    const currentIndex = selectedDates.findIndex((d) => formatDateISO(d) === activeDateISO);
    for (let i = currentIndex + 1; i < selectedDates.length; i++) {
      const iso = formatDateISO(selectedDates[i]);
      if (!newAssignments[iso]) {
        setActiveDateISO(iso);
        fetchSlots(selectedDates[i], selectedService.durationMinutes);
        return;
      }
    }
    for (let i = 0; i < currentIndex; i++) {
      const iso = formatDateISO(selectedDates[i]);
      if (!newAssignments[iso]) {
        setActiveDateISO(iso);
        fetchSlots(selectedDates[i], selectedService.durationMinutes);
        return;
      }
    }
  };

  // ── Submit ──

  const getOnetimeSuccessDescription = (): string => {
    const isGhost = selectedClient?.isGhost;
    if (mode === 'single' && selectedDate && selectedTime && selectedService) {
      const who = selectedClient
        ? t('successClientBooked', { name: selectedClient.displayName || selectedClient.name })
        : t('successYouAreBooked');
      const monthKey = monthGenKeys[selectedDate.getMonth()];
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
      const multiFor = selectedClient
        ? t('successMultiFor', { name: selectedClient.displayName || selectedClient.name })
        : '';
      const confirm = isGhost ? '' : t('successAwaitConfirmation');
      return `${t('successMultiCount', { count: selectedDates.length })}${multiFor}.${confirm}`;
    }
    return isGhost ? t('successBookingCreated') : t('successAwaitConfirmation');
  };

  const handleSingleSubmit = async (): Promise<void> => {
    if (!selectedDate || !selectedTime || !selectedService) {
      return;
    }
    if (hasClientSelector && !selectedClient) {
      return;
    }
    setIsSubmitting(true);
    try {
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
      const msg = err instanceof Error ? err.message : te('bookingCreateFailed');
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

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
        const iso = formatDateISO(date);
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
      const msg = err instanceof Error ? err.message : te('bookingCreateFailed');
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOnetimeSubmit = (): void => {
    if (mode === 'single') {
      handleSingleSubmit();
    } else {
      handleMultiSubmit();
    }
  };

  // ── Button state ──

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
    const allAssigned = selectedDates.every((d) => timeAssignments[formatDateISO(d)]);
    if (!allAssigned) {
      return { text: t('btnSelectTime'), disabled: true };
    }
    return { text: isSubmitting ? tc('sending') : t('btnSubmit'), disabled: isSubmitting };
  };

  const { text: onetimeButtonText, disabled: onetimeButtonDisabled } = getOnetimeButtonState();
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
