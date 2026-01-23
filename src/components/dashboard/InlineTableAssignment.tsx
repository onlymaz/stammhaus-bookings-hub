import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, X, Table2, Loader2, Search } from "lucide-react";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [zoneFilter, setZoneFilter] = useState<'all' | 'inside' | 'garden'>('all');

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
      
      // Fetch all available tables (no min capacity filter to show all options)
      const { data, error } = await supabase.rpc('get_available_tables', {
        _date: reservationDate,
        _start_time: reservationTime,
        _end_time: endTime,
        _min_capacity: 1, // Show all tables, let user choose
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
    setSearchQuery("");
    setZoneFilter('all');
    fetchAvailableTables();
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSelectedTableId(currentTableId || "");
    setSearchQuery("");
  };

  // Filter tables based on search and zone
  const filteredTables = availableTables.filter(table => {
    const matchesSearch = table.table_number.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesZone = zoneFilter === 'all' || table.zone === zoneFilter;
    return matchesSearch && matchesZone;
  });

  // Group tables by zone for display
  const insideTables = filteredTables.filter(t => t.zone === 'inside');
  const gardenTables = filteredTables.filter(t => t.zone === 'garden');

  const selectedTable = availableTables.find(t => t.id === selectedTableId);

  if (isEditing) {
    return (
      <div 
        className="mt-2 sm:mt-3 p-2 sm:p-3 rounded-lg border-2 border-primary/30 bg-primary/5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-1.5 mb-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
            <Table2 className="h-3 w-3" />
            Assign Table ({guests} guests)
          </div>
          <div className="text-[10px] text-muted-foreground">
            {availableTables.length} available
          </div>
        </div>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Search and Filter */}
            <div className="space-y-2 mb-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder="Search table..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-7 text-xs pl-7 bg-background"
                />
              </div>
              
              {/* Zone Filter Tabs */}
              <div className="flex gap-1">
                <Button
                  variant={zoneFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  className="h-6 px-2 text-[10px] flex-1"
                  onClick={() => setZoneFilter('all')}
                >
                  All ({availableTables.length})
                </Button>
                <Button
                  variant={zoneFilter === 'inside' ? 'default' : 'outline'}
                  size="sm"
                  className="h-6 px-2 text-[10px] flex-1"
                  onClick={() => setZoneFilter('inside')}
                >
                  Inside ({availableTables.filter(t => t.zone === 'inside').length})
                </Button>
                <Button
                  variant={zoneFilter === 'garden' ? 'default' : 'outline'}
                  size="sm"
                  className="h-6 px-2 text-[10px] flex-1"
                  onClick={() => setZoneFilter('garden')}
                >
                  Garden ({availableTables.filter(t => t.zone === 'garden').length})
                </Button>
              </div>
            </div>

            {/* Table List */}
            <ScrollArea className="h-[150px] rounded border bg-background">
              {filteredTables.length === 0 ? (
                <div className="py-4 px-3 text-xs text-muted-foreground text-center">
                  {searchQuery ? 'No tables match your search' : 'No tables available'}
                </div>
              ) : (
                <div className="p-1 space-y-0.5">
                  {zoneFilter === 'all' && insideTables.length > 0 && (
                    <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground bg-muted/50 rounded">
                      Inside ({insideTables.length})
                    </div>
                  )}
                  {(zoneFilter === 'all' || zoneFilter === 'inside') && insideTables.map((table) => (
                    <button
                      key={table.id}
                      onClick={() => setSelectedTableId(table.id)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors",
                        selectedTableId === table.id
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      )}
                    >
                      <span className="font-medium">T{table.table_number}</span>
                      {table.id === currentTableId && (
                        <Check className="h-3 w-3 ml-auto" />
                      )}
                    </button>
                  ))}
                  
                  {zoneFilter === 'all' && gardenTables.length > 0 && (
                    <div className="px-2 py-1 mt-1 text-[10px] font-medium text-muted-foreground bg-muted/50 rounded">
                      Garden ({gardenTables.length})
                    </div>
                  )}
                  {(zoneFilter === 'all' || zoneFilter === 'garden') && gardenTables.map((table) => (
                    <button
                      key={table.id}
                      onClick={() => setSelectedTableId(table.id)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors",
                        selectedTableId === table.id
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      )}
                    >
                      <span className="font-medium">T{table.table_number}</span>
                      {table.id === currentTableId && (
                        <Check className="h-3 w-3 ml-auto" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Selected Table Display */}
            {selectedTable && (
              <div className="mt-2 px-2 py-1 rounded bg-primary/10 text-xs">
                Selected: <span className="font-medium">Table {selectedTable.table_number}</span>
              </div>
            )}

            {/* Action Buttons */}
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
