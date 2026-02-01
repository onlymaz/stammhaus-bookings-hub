import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RestaurantTable, TableZone, TableConflict, DiningStatus } from "@/types/table";
import { toast } from "sonner";

// Default reservation duration in minutes
const DEFAULT_DURATION_MINUTES = 120;

export const useTableManagement = () => {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTables = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tables")
      .select("*")
      .order("zone", { ascending: true })
      .order("table_number", { ascending: true });

    if (!error && data) {
      setTables(data as RestaurantTable[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  // Add end time helper (2 hours default)
  const calculateEndTime = (startTime: string, durationMinutes: number = DEFAULT_DURATION_MINUTES): string => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMins = totalMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}:00`;
  };

  // Check if table is available for a given time range
  const checkTableAvailability = async (
    tableId: string,
    date: string,
    startTime: string,
    endTime: string,
    excludeReservationId?: string
  ): Promise<boolean> => {
    const { data, error } = await supabase.rpc('is_table_available', {
      _table_id: tableId,
      _date: date,
      _start_time: startTime,
      _end_time: endTime,
      _exclude_reservation_id: excludeReservationId || null
    });

    if (error) {
      console.error('Error checking availability:', error);
      return false;
    }

    return data as boolean;
  };

  // Get conflicting reservation details
  const getTableConflict = async (
    tableId: string,
    date: string,
    startTime: string,
    endTime: string,
    excludeReservationId?: string
  ): Promise<TableConflict | null> => {
    const { data, error } = await supabase.rpc('get_table_conflict', {
      _table_id: tableId,
      _date: date,
      _start_time: startTime,
      _end_time: endTime,
      _exclude_reservation_id: excludeReservationId || null
    });

    if (error || !data || data.length === 0) {
      return null;
    }

    return data[0] as TableConflict;
  };

  // Get all available tables for a time range
  const getAvailableTables = async (
    date: string,
    startTime: string,
    endTime: string,
    zone?: TableZone,
    minCapacity: number = 1
  ): Promise<RestaurantTable[]> => {
    const { data, error } = await supabase.rpc('get_available_tables', {
      _date: date,
      _start_time: startTime,
      _end_time: endTime,
      _zone: zone || null,
      _min_capacity: minCapacity
    });

    if (error) {
      console.error('Error getting available tables:', error);
      return [];
    }

    return (data || []) as RestaurantTable[];
  };

  // Assign a table to a reservation
  const assignTable = async (
    reservationId: string,
    tableId: string,
    date: string,
    startTime: string,
    endTime?: string
  ): Promise<{ success: boolean; error?: string; conflict?: TableConflict }> => {
    const effectiveEndTime = endTime || calculateEndTime(startTime);

    // First check for conflicts
    const conflict = await getTableConflict(tableId, date, startTime, effectiveEndTime, reservationId);
    
    if (conflict) {
      return { 
        success: false, 
        error: `Table is already reserved from ${conflict.start_time.slice(0, 5)} to ${conflict.end_time.slice(0, 5)} by ${conflict.customer_name}.`,
        conflict 
      };
    }

    // Update reservation with assigned table
    const { error } = await supabase
      .from("reservations")
      .update({ 
        assigned_table_id: tableId,
        reservation_end_time: effectiveEndTime
      })
      .eq("id", reservationId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  };

  // Release a table from a reservation
  const releaseTable = async (reservationId: string): Promise<boolean> => {
    const { error } = await supabase
      .from("reservations")
      .update({ assigned_table_id: null })
      .eq("id", reservationId);

    if (error) {
      toast.error("Failed to release table: " + error.message);
      return false;
    }

    toast.success("Table released");
    return true;
  };

  // Update dining status
  const updateDiningStatus = async (
    reservationId: string,
    status: DiningStatus
  ): Promise<boolean> => {
    const { error } = await supabase
      .from("reservations")
      .update({ dining_status: status })
      .eq("id", reservationId);

    if (error) {
      toast.error("Failed to update status: " + error.message);
      return false;
    }

    toast.success(`Status updated to ${status}`);
    return true;
  };

  // Extend reservation end time
  const extendReservation = async (
    reservationId: string,
    tableId: string,
    date: string,
    currentStartTime: string,
    newEndTime: string
  ): Promise<{ success: boolean; error?: string; conflict?: TableConflict }> => {
    // Check for conflicts with the extended time
    const conflict = await getTableConflict(tableId, date, currentStartTime, newEndTime, reservationId);
    
    if (conflict) {
      return { 
        success: false, 
        error: `Cannot extend. Table is reserved again at ${conflict.start_time.slice(0, 5)} by ${conflict.customer_name}.`,
        conflict 
      };
    }

    // Update reservation end time
    const { error } = await supabase
      .from("reservations")
      .update({ reservation_end_time: newEndTime })
      .eq("id", reservationId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  };

  // Create a new table
  const createTable = async (
    tableNumber: string,
    capacity: number,
    zone: TableZone
  ): Promise<boolean> => {
    const { error } = await supabase
      .from("tables")
      .insert({
        table_number: tableNumber,
        capacity,
        zone,
        seats: capacity,
        is_active: true
      });

    if (error) {
      if (error.code === '23505') {
        toast.error("Table number already exists");
      } else {
        toast.error("Failed to create table: " + error.message);
      }
      return false;
    }

    toast.success(`Table ${tableNumber} created`);
    await fetchTables();
    return true;
  };

  // Update a table
  const updateTable = async (
    tableId: string,
    updates: Partial<Pick<RestaurantTable, 'table_number' | 'capacity' | 'zone' | 'is_active'>>
  ): Promise<boolean> => {
    const { error } = await supabase
      .from("tables")
      .update({
        ...updates,
        seats: updates.capacity ?? undefined
      })
      .eq("id", tableId);

    if (error) {
      toast.error("Failed to update table: " + error.message);
      return false;
    }

    toast.success("Table updated");
    await fetchTables();
    return true;
  };

  // Delete a table
  const deleteTable = async (tableId: string): Promise<boolean> => {
    const { error } = await supabase
      .from("tables")
      .delete()
      .eq("id", tableId);

    if (error) {
      toast.error("Failed to delete table: " + error.message);
      return false;
    }

    toast.success("Table deleted");
    await fetchTables();
    return true;
  };

  // Get tables by zone
  const getTablesByZone = (zone: TableZone): RestaurantTable[] => {
    return tables.filter(t => t.zone === zone && t.is_active);
  };

  // Stats
  const insideTables = tables.filter(t => t.zone === 'inside' && t.is_active);
  const gardenTables = tables.filter(t => t.zone === 'garden' && t.is_active);

  return {
    tables,
    loading,
    fetchTables,
    calculateEndTime,
    checkTableAvailability,
    getTableConflict,
    getAvailableTables,
    assignTable,
    releaseTable,
    updateDiningStatus,
    extendReservation,
    createTable,
    updateTable,
    deleteTable,
    getTablesByZone,
    insideTables,
    gardenTables,
    totalCapacity: tables.reduce((sum, t) => t.is_active ? sum + t.capacity : sum, 0)
  };
};
