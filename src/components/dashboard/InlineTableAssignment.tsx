import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, X, Table2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Table {
  id: string;
  table_number: string;
  capacity: number;
  zone: 'inside' | 'garden';
}

interface InlineTableAssignmentProps {
  reservationId: string;
  reservationDate: string;
  reservationTime: string;
  reservationEndTime: string | null;
  currentTableId: string | null;
  currentTableNumber?: string | null;
  guests: number;
  onTableAssigned: () => void;
}

export const InlineTableAssignment = ({
  reservationId,
  reservationDate,
  reservationTime,
  reservationEndTime,
  currentTableId,
  currentTableNumber,
  guests,
  onTableAssigned,
}: InlineTableAssignmentProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<string>(currentTableId || "");
  const [availableTables, setAvailableTables] = useState<Table[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Calculate end time if not provided (default 1.5 hours)
  const getEndTime = () => {
    if (reservationEndTime) return reservationEndTime;
    const [hours, minutes] = reservationTime.split(':').map(Number);
    const endHours = hours + 1;
    const endMinutes = minutes + 30;
    const adjustedHours = endMinutes >= 60 ? endHours + 1 : endHours;
    const adjustedMinutes = endMinutes >= 60 ? endMinutes - 60 : endMinutes;
    return `${String(adjustedHours).padStart(2, '0')}:${String(adjustedMinutes).padStart(2, '0')}:00`;
  };

  const fetchAvailableTables = async () => {
    setIsLoading(true);
    try {
      const endTime = getEndTime();
      
      const { data, error } = await supabase.rpc('get_available_tables', {
        _date: reservationDate,
        _start_time: reservationTime,
        _end_time: endTime,
        _min_capacity: guests,
      });

      if (error) throw error;

      // Also fetch the currently assigned table if it exists (so it appears in the list)
      let tables = data || [];
      
      if (currentTableId) {
        const currentInList = tables.find((t: Table) => t.id === currentTableId);
        if (!currentInList) {
          const { data: currentTable } = await supabase
            .from('tables')
            .select('*')
            .eq('id', currentTableId)
            .single();
          
          if (currentTable) {
            tables = [currentTable, ...tables];
          }
        }
      }

      setAvailableTables(tables);
    } catch (error) {
      console.error('Error fetching available tables:', error);
      toast.error('Failed to load available tables');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedTableId) {
      toast.error('Please select a table');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('reservations')
        .update({ assigned_table_id: selectedTableId })
        .eq('id', reservationId);

      if (error) throw error;

      toast.success('Table assigned successfully');
      setIsEditing(false);
      onTableAssigned();
    } catch (error: any) {
      console.error('Error assigning table:', error);
      toast.error(error.message || 'Failed to assign table');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('reservations')
        .update({ assigned_table_id: null })
        .eq('id', reservationId);

      if (error) throw error;

      toast.success('Table assignment removed');
      setSelectedTableId("");
      setIsEditing(false);
      onTableAssigned();
    } catch (error: any) {
      console.error('Error removing table:', error);
      toast.error(error.message || 'Failed to remove table');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartEdit = () => {
    setIsEditing(true);
    setSelectedTableId(currentTableId || "");
    fetchAvailableTables();
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSelectedTableId(currentTableId || "");
  };

  if (isEditing) {
    return (
      <div 
        className="mt-2 sm:mt-3 p-2 sm:p-3 rounded-lg border-2 border-primary/30 bg-primary/5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-primary">
          <Table2 className="h-3 w-3" />
          Assign Table
        </div>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <Select
              value={selectedTableId}
              onValueChange={setSelectedTableId}
            >
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue placeholder="Select a table..." />
              </SelectTrigger>
              <SelectContent className="z-50 bg-background">
                {availableTables.length === 0 ? (
                  <div className="py-2 px-3 text-xs text-muted-foreground">
                    No tables available for this time slot
                  </div>
                ) : (
                  availableTables.map((table) => (
                    <SelectItem key={table.id} value={table.id} className="text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">T{table.table_number}</span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0">
                          {table.zone === 'inside' ? 'Inside' : 'Garden'}
                        </Badge>
                        <span className="text-muted-foreground">
                          ({table.capacity} seats)
                        </span>
                        {table.id === currentTableId && (
                          <span className="text-primary text-[9px]">(current)</span>
                        )}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1.5 mt-2 justify-end">
              {currentTableId && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={handleClear}
                  disabled={isSaving}
                >
                  Clear
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={handleCancel}
                disabled={isSaving}
              >
                <X className="h-2.5 w-2.5 mr-0.5" />
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={handleSave}
                disabled={isSaving || !selectedTableId}
              >
                {isSaving ? (
                  <Loader2 className="h-2.5 w-2.5 mr-0.5 animate-spin" />
                ) : (
                  <Check className="h-2.5 w-2.5 mr-0.5" />
                )}
                Assign
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }

  // Display mode
  return (
    <div 
      className={cn(
        "mt-2 sm:mt-3 flex items-center gap-2 cursor-pointer group/table",
        currentTableId ? "px-2 py-1.5 rounded-md bg-primary/10 border border-primary/20" : ""
      )}
      onClick={(e) => {
        e.stopPropagation();
        handleStartEdit();
      }}
    >
      <Table2 className={cn(
        "h-3 w-3",
        currentTableId ? "text-primary" : "text-muted-foreground"
      )} />
      {currentTableId && currentTableNumber ? (
        <span className="text-xs font-medium text-primary">
          Table {currentTableNumber}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground group-hover/table:text-primary transition-colors">
          + Assign Table
        </span>
      )}
      {currentTableId && (
        <Check className="h-3 w-3 text-primary ml-auto" />
      )}
    </div>
  );
};
