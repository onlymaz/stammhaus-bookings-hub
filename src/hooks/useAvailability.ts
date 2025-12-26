import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { OperatingHours, CapacitySettings, BlockedDate, TimeSlot } from '@/types/reservation';
import { format, addMinutes, parse, isAfter, isBefore, isEqual } from 'date-fns';

export function useAvailability() {
  const [operatingHours, setOperatingHours] = useState<OperatingHours[]>([]);
  const [capacitySettings, setCapacitySettings] = useState<CapacitySettings | null>(null);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const [hoursRes, capacityRes, blockedRes] = await Promise.all([
        supabase.from('operating_hours').select('*').order('day_of_week'),
        supabase.from('capacity_settings').select('*').limit(1).single(),
        supabase.from('blocked_dates').select('*'),
      ]);

      if (hoursRes.data) {
        setOperatingHours(hoursRes.data as OperatingHours[]);
      }
      if (capacityRes.data) {
        setCapacitySettings(capacityRes.data as CapacitySettings);
      }
      if (blockedRes.data) {
        setBlockedDates(blockedRes.data as BlockedDate[]);
      }
    } catch (error) {
      console.error('Error fetching availability settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const isDateBlocked = useCallback((date: Date): boolean => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return blockedDates.some(bd => bd.blocked_date === dateStr);
  }, [blockedDates]);

  const getDayHours = useCallback((date: Date): OperatingHours | undefined => {
    const dayOfWeek = date.getDay();
    return operatingHours.find(oh => oh.day_of_week === dayOfWeek);
  }, [operatingHours]);

  const isDateOpen = useCallback((date: Date): boolean => {
    if (isDateBlocked(date)) return false;
    const hours = getDayHours(date);
    return hours ? !hours.is_closed : false;
  }, [isDateBlocked, getDayHours]);

  const generateTimeSlots = useCallback((
    startTime: string | null,
    endTime: string | null,
    slotDuration: number
  ): string[] => {
    if (!startTime || !endTime) return [];

    const slots: string[] = [];
    let current = parse(startTime, 'HH:mm:ss', new Date());
    const end = parse(endTime, 'HH:mm:ss', new Date());

    while (isBefore(current, end) || isEqual(current, end)) {
      slots.push(format(current, 'HH:mm'));
      current = addMinutes(current, slotDuration);
    }

    return slots;
  }, []);

  const getAvailableSlots = useCallback(async (
    date: Date,
    guestCount: number
  ): Promise<TimeSlot[]> => {
    if (!capacitySettings || !isDateOpen(date)) {
      return [];
    }

    const hours = getDayHours(date);
    if (!hours) return [];

    const slotDuration = capacitySettings.slot_duration_minutes;
    
    // Generate all possible time slots for lunch and dinner
    const lunchSlots = generateTimeSlots(hours.lunch_start, hours.lunch_end, slotDuration);
    const dinnerSlots = generateTimeSlots(hours.dinner_start, hours.dinner_end, slotDuration);
    const allSlots = [...new Set([...lunchSlots, ...dinnerSlots])].sort();

    // Get existing reservations for this date
    const dateStr = format(date, 'yyyy-MM-dd');
    const { data: reservations } = await supabase
      .from('reservations')
      .select('reservation_time, guests')
      .eq('reservation_date', dateStr)
      .in('status', ['new', 'confirmed']);

    // Calculate availability for each slot
    const timeSlots: TimeSlot[] = allSlots.map(time => {
      const reservationsAtSlot = reservations?.filter(r => 
        r.reservation_time.substring(0, 5) === time
      ) || [];

      const bookedGuests = reservationsAtSlot.reduce((sum, r) => sum + r.guests, 0);
      const bookedTables = reservationsAtSlot.length;

      const remainingGuests = capacitySettings.max_guests_per_slot - bookedGuests;
      const remainingTables = capacitySettings.max_tables_per_slot - bookedTables;

      return {
        time,
        available: remainingGuests >= guestCount && remainingTables > 0,
        remainingGuests,
        remainingTables,
      };
    });

    // Filter out past times if the date is today
    const now = new Date();
    const isToday = format(date, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');
    
    if (isToday) {
      const currentTime = format(now, 'HH:mm');
      return timeSlots.filter(slot => slot.time > currentTime);
    }

    return timeSlots;
  }, [capacitySettings, isDateOpen, getDayHours, generateTimeSlots]);

  return {
    operatingHours,
    capacitySettings,
    blockedDates,
    isLoading,
    isDateBlocked,
    isDateOpen,
    getDayHours,
    getAvailableSlots,
    refetch: fetchSettings,
  };
}
