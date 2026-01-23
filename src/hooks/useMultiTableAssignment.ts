import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RestaurantTable, TableZone } from "@/types/table";
import { toast } from "sonner";

interface AssignedTable {
  id: string;
  table_id: string;
  table: RestaurantTable;
}

export const useMultiTableAssignment = () => {
  const [loading, setLoading] = useState(false);

  // Calculate end time (default 90 minutes)
  const calculateEndTime = (startTime: string, durationMinutes: number = 90): string => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMins = totalMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}:00`;
  };

  // Fetch tables currently assigned to a reservation
  const getAssignedTables = useCallback(async (reservationId: string): Promise<AssignedTable[]> => {
    const { data, error } = await supabase
      .from("reservation_tables")
      .select(`
        id,
        table_id,
        table:tables(*)
      `)
      .eq("reservation_id", reservationId);

    if (error) {
      console.error("Error fetching assigned tables:", error);
      return [];
    }

    return (data || []).map(item => ({
      id: item.id,
      table_id: item.table_id,
      table: item.table as unknown as RestaurantTable
    }));
  }, []);

  // Get available tables for a time slot
  const getAvailableTables = useCallback(async (
    date: string,
    startTime: string,
    endTime: string,
    excludeReservationId?: string
  ): Promise<RestaurantTable[]> => {
    const { data, error } = await supabase.rpc('get_available_tables', {
      _date: date,
      _start_time: startTime,
      _end_time: endTime,
      _min_capacity: 1
    });

    if (error) {
      console.error("Error getting available tables:", error);
      return [];
    }

    return (data || []) as RestaurantTable[];
  }, []);

  // Assign multiple tables to a reservation
  const assignTables = useCallback(async (
    reservationId: string,
    tableIds: string[],
    date: string,
    startTime: string,
    endTime?: string
  ): Promise<{ success: boolean; error?: string }> => {
    setLoading(true);
    
    try {
      const effectiveEndTime = endTime || calculateEndTime(startTime);

      // First, remove all existing table assignments
      const { error: deleteError } = await supabase
        .from("reservation_tables")
        .delete()
        .eq("reservation_id", reservationId);

      if (deleteError) {
        throw new Error("Failed to clear existing assignments: " + deleteError.message);
      }

      // Also clear the single assigned_table_id on the reservation
      await supabase
        .from("reservations")
        .update({ 
          assigned_table_id: null,
          reservation_end_time: effectiveEndTime 
        })
        .eq("id", reservationId);

      if (tableIds.length === 0) {
        setLoading(false);
        return { success: true };
      }

      // Insert new assignments
      const insertData = tableIds.map(tableId => ({
        reservation_id: reservationId,
        table_id: tableId
      }));

      const { error: insertError } = await supabase
        .from("reservation_tables")
        .insert(insertData);

      if (insertError) {
        throw new Error("Failed to assign tables: " + insertError.message);
      }

      // Also set the first table as assigned_table_id for backwards compatibility
      if (tableIds.length > 0) {
        await supabase
          .from("reservations")
          .update({ 
            assigned_table_id: tableIds[0],
            reservation_end_time: effectiveEndTime 
          })
          .eq("id", reservationId);
      }

      setLoading(false);
      return { success: true };
    } catch (error: any) {
      setLoading(false);
      console.error("Error assigning tables:", error);
      return { success: false, error: error.message };
    }
  }, []);

  // Release all tables from a reservation
  const releaseAllTables = useCallback(async (reservationId: string): Promise<boolean> => {
    setLoading(true);
    
    try {
      // Remove from junction table
      const { error: deleteError } = await supabase
        .from("reservation_tables")
        .delete()
        .eq("reservation_id", reservationId);

      if (deleteError) throw deleteError;

      // Clear assigned_table_id
      const { error: updateError } = await supabase
        .from("reservations")
        .update({ assigned_table_id: null })
        .eq("id", reservationId);

      if (updateError) throw updateError;

      setLoading(false);
      toast.success("All tables released");
      return true;
    } catch (error: any) {
      setLoading(false);
      toast.error("Failed to release tables: " + error.message);
      return false;
    }
  }, []);

  return {
    loading,
    calculateEndTime,
    getAssignedTables,
    getAvailableTables,
    assignTables,
    releaseAllTables
  };
};
