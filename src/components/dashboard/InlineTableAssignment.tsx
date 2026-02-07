import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, X, Table2, Loader2, Search, Home, TreePine, Building, Layers } from "lucide-react";
import { TableZone, RestaurantTable } from "@/types/table";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useMultiTableAssignment } from "@/hooks/useMultiTableAssignment";

interface Table {
  id: string;
  table_number: string;
  capacity: number;
  zone: TableZone;
}

interface InlineTableAssignmentProps {
  reservationId: string;
  reservationDate: string;
  reservationTime: string;
  reservationEndTime: string | null;
  currentTableId: string | null;
  currentTableNumber?: string | null;
  guests: number;
  diningStatus?: string;
  onTableAssigned: () => void;
  onDiningStatusChange?: () => void;
}

export const InlineTableAssignment = ({
  reservationId,
  reservationDate,
  reservationTime,
  reservationEndTime,
  currentTableId,
  currentTableNumber,
  guests,
  diningStatus,
  onTableAssigned,
  onDiningStatusChange,
}: InlineTableAssignmentProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTableIds, setSelectedTableIds] = useState<Set<string>>(new Set());
  const [availableTables, setAvailableTables] = useState<Table[]>([]);
  const [assignedTables, setAssignedTables] = useState<RestaurantTable[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isMarkingReserved, setIsMarkingReserved] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [zoneFilter, setZoneFilter] = useState<'all' | TableZone>('all');
  
  const { assignTables, getAssignedTables, releaseAllTables, calculateEndTime } = useMultiTableAssignment();

  // Fetch assigned tables on mount
  const fetchAssignedTablesData = useCallback(async () => {
    const assigned = await getAssignedTables(reservationId);
    setAssignedTables(assigned.map(a => a.table));
  }, [reservationId, getAssignedTables]);

  useEffect(() => {
    fetchAssignedTablesData();
  }, [fetchAssignedTablesData]);

  // Calculate end time if not provided (default 2 hours)
  const getEndTime = () => {
    if (reservationEndTime) return reservationEndTime;
    return calculateEndTime(reservationTime);
  };

  const fetchAvailableTables = async () => {
    setIsLoading(true);
    try {
      const endTime = getEndTime();
      
      // Fetch all available tables
      const { data, error } = await supabase.rpc('get_available_tables', {
        _date: reservationDate,
        _start_time: reservationTime,
        _end_time: endTime,
        _min_capacity: 1,
      });

      if (error) throw error;

      let tables = data || [];
      
      // Include currently assigned tables
      const assigned = await getAssignedTables(reservationId);
      for (const a of assigned) {
        if (!tables.find((t: Table) => t.id === a.table_id)) {
          tables = [a.table, ...tables];
        }
      }
      
      // Pre-select assigned tables
      setSelectedTableIds(new Set(assigned.map(a => a.table_id)));

      setAvailableTables(tables);
    } catch (error) {
      console.error('Error fetching available tables:', error);
      toast.error('Verfügbare Tische konnten nicht geladen werden');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTable = (tableId: string) => {
    setSelectedTableIds(prev => {
      const next = new Set(prev);
      if (next.has(tableId)) {
        next.delete(tableId);
      } else {
        next.add(tableId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const tableIds = Array.from(selectedTableIds);
      const endTime = getEndTime();
      
      const result = await assignTables(
        reservationId,
        tableIds,
        reservationDate,
        reservationTime,
        endTime
      );

      if (!result.success) throw new Error(result.error);

      toast.success(tableIds.length > 0 
        ? `${tableIds.length} Tisch${tableIds.length > 1 ? 'e' : ''} zugewiesen` 
        : 'Tische entfernt'
      );
      setIsEditing(false);
      fetchAssignedTablesData();
      onTableAssigned();
    } catch (error: any) {
      console.error('Error assigning tables:', error);
      toast.error(error.message || 'Tische konnten nicht zugewiesen werden');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    setIsSaving(true);
    try {
      const success = await releaseAllTables(reservationId);
      if (success) {
        setSelectedTableIds(new Set());
        setIsEditing(false);
        fetchAssignedTablesData();
        onTableAssigned();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartEdit = () => {
    setIsEditing(true);
    setSearchQuery("");
    setZoneFilter('all');
    fetchAvailableTables();
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSearchQuery("");
  };

  // Mark reservation as "Reserved" (staff action taken)
  const handleMarkReserved = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMarkingReserved(true);
    try {
      const { error } = await supabase
        .from('reservations')
        .update({ dining_status: 'seated' })
        .eq('id', reservationId);

      if (error) throw error;

      toast.success('Als platziert markiert');
      onDiningStatusChange?.();
    } catch (error: any) {
      console.error('Error marking reservation:', error);
      toast.error('Status konnte nicht aktualisiert werden');
    } finally {
      setIsMarkingReserved(false);
    }
  };

  // Table names now include prefix (T01, R37, G47, M01) - use directly
  const getTableDisplayName = (table: Table) => table.table_number;

  // Helper for numeric sorting
  const getTableNumeric = (tableNumber: string) => {
    const match = tableNumber.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  };

  // Zone order for sorting
  const zoneOrder: Record<string, number> = { inside: 0, room: 1, garden: 2, mezz: 3 };

  // Filter and sort tables based on search and zone
  const filteredTables = availableTables
    .filter(table => {
      const displayName = getTableDisplayName(table).toLowerCase();
      const matchesSearch = !searchQuery || displayName.includes(searchQuery.toLowerCase());
      const matchesZone = zoneFilter === 'all' || table.zone === zoneFilter;
      return matchesSearch && matchesZone;
    })
    .sort((a, b) => {
      const zoneA = zoneOrder[a.zone] ?? 99;
      const zoneB = zoneOrder[b.zone] ?? 99;
      if (zoneA !== zoneB) return zoneA - zoneB;
      return getTableNumeric(a.table_number) - getTableNumeric(b.table_number);
    });

  // Group tables by zone for display
  const insideTables = filteredTables.filter(t => t.zone === 'inside');
  const roomTables = filteredTables.filter(t => t.zone === 'room');
  const gardenTables = filteredTables.filter(t => t.zone === 'garden');
  const mezzTables = filteredTables.filter(t => t.zone === 'mezz');

  const selectedTablesData = availableTables.filter(t => selectedTableIds.has(t.id));
  const totalSelectedCapacity = selectedTablesData.reduce((sum, t) => sum + t.capacity, 0);

  if (isEditing) {
    return (
      <div 
        className="mt-2 sm:mt-3 p-2 sm:p-3 rounded-lg border-2 border-primary/30 bg-primary/5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-1.5 mb-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
            <Table2 className="h-3 w-3" />
            Tisch zuweisen ({guests} Gäste)
          </div>
          <div className="text-[10px] text-muted-foreground">
            {availableTables.length} verfügbar
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
                  placeholder="Tisch suchen..."
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
                  Alle
                </Button>
                <Button
                  variant={zoneFilter === 'inside' ? 'default' : 'outline'}
                  size="sm"
                  className="h-6 px-1.5 text-[10px] flex-1"
                  onClick={() => setZoneFilter('inside')}
                >
                  <Home className="h-2.5 w-2.5" />
                </Button>
                <Button
                  variant={zoneFilter === 'room' ? 'default' : 'outline'}
                  size="sm"
                  className="h-6 px-1.5 text-[10px] flex-1"
                  onClick={() => setZoneFilter('room')}
                >
                  <Building className="h-2.5 w-2.5" />
                </Button>
                <Button
                  variant={zoneFilter === 'garden' ? 'default' : 'outline'}
                  size="sm"
                  className="h-6 px-1.5 text-[10px] flex-1"
                  onClick={() => setZoneFilter('garden')}
                >
                  <TreePine className="h-2.5 w-2.5" />
                </Button>
                <Button
                  variant={zoneFilter === 'mezz' ? 'default' : 'outline'}
                  size="sm"
                  className="h-6 px-1.5 text-[10px] flex-1"
                  onClick={() => setZoneFilter('mezz')}
                >
                  <Layers className="h-2.5 w-2.5" />
                </Button>
              </div>
            </div>

            {/* Table List */}
            <ScrollArea className="h-[150px] rounded border bg-background">
              {filteredTables.length === 0 ? (
                <div className="py-4 px-3 text-xs text-muted-foreground text-center">
                  {searchQuery ? 'Keine passenden Tische' : 'Keine Tische verfügbar'}
                </div>
              ) : (
                <div className="p-1 space-y-0.5">
                  {/* Inside Tables */}
                  {(zoneFilter === 'all' || zoneFilter === 'inside') && insideTables.length > 0 && (
                    <>
                      {zoneFilter === 'all' && (
                        <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground bg-muted/50 rounded flex items-center gap-1">
                          <Home className="h-2.5 w-2.5" /> Innen ({insideTables.length})
                        </div>
                      )}
                      {insideTables.map((table) => (
                        <button
                          key={table.id}
                          onClick={() => toggleTable(table.id)}
                          className={cn(
                            "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors",
                            selectedTableIds.has(table.id) ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                          )}
                        >
                          <span className="font-medium">{getTableDisplayName(table)}</span>
                          {selectedTableIds.has(table.id) && <Check className="h-3 w-3 ml-auto" />}
                        </button>
                      ))}
                    </>
                  )}
                  
                  {/* Room Tables */}
                  {(zoneFilter === 'all' || zoneFilter === 'room') && roomTables.length > 0 && (
                    <>
                      {zoneFilter === 'all' && (
                        <div className="px-2 py-1 mt-1 text-[10px] font-medium text-muted-foreground bg-muted/50 rounded flex items-center gap-1">
                          <Building className="h-2.5 w-2.5" /> Raum ({roomTables.length})
                        </div>
                      )}
                      {roomTables.map((table) => (
                        <button
                          key={table.id}
                          onClick={() => toggleTable(table.id)}
                          className={cn(
                            "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors",
                            selectedTableIds.has(table.id) ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                          )}
                        >
                          <span className="font-medium">{getTableDisplayName(table)}</span>
                          {selectedTableIds.has(table.id) && <Check className="h-3 w-3 ml-auto" />}
                        </button>
                      ))}
                    </>
                  )}
                  
                  {/* Garden Tables */}
                  {(zoneFilter === 'all' || zoneFilter === 'garden') && gardenTables.length > 0 && (
                    <>
                      {zoneFilter === 'all' && (
                        <div className="px-2 py-1 mt-1 text-[10px] font-medium text-muted-foreground bg-muted/50 rounded flex items-center gap-1">
                          <TreePine className="h-2.5 w-2.5" /> Garten ({gardenTables.length})
                        </div>
                      )}
                      {gardenTables.map((table) => (
                        <button
                          key={table.id}
                          onClick={() => toggleTable(table.id)}
                          className={cn(
                            "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors",
                            selectedTableIds.has(table.id) ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                          )}
                        >
                          <span className="font-medium">{getTableDisplayName(table)}</span>
                          {selectedTableIds.has(table.id) && <Check className="h-3 w-3 ml-auto" />}
                        </button>
                      ))}
                    </>
                  )}
                  
                  {/* Mezz Tables */}
                  {(zoneFilter === 'all' || zoneFilter === 'mezz') && mezzTables.length > 0 && (
                    <>
                      {zoneFilter === 'all' && (
                        <div className="px-2 py-1 mt-1 text-[10px] font-medium text-muted-foreground bg-muted/50 rounded flex items-center gap-1">
                          <Layers className="h-2.5 w-2.5" /> Empore ({mezzTables.length})
                        </div>
                      )}
                      {mezzTables.map((table) => (
                        <button
                          key={table.id}
                          onClick={() => toggleTable(table.id)}
                          className={cn(
                            "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors",
                            selectedTableIds.has(table.id) ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                          )}
                        >
                          <span className="font-medium">{getTableDisplayName(table)}</span>
                          {selectedTableIds.has(table.id) && <Check className="h-3 w-3 ml-auto" />}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </ScrollArea>

            {/* Selected Tables Display */}
            {selectedTablesData.length > 0 && (
              <div className="mt-2 px-2 py-1.5 rounded bg-primary/10 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {selectedTablesData.length} Tisch{selectedTablesData.length > 1 ? 'e' : ''} ausgewählt
                  </span>
                  <span className="text-muted-foreground">
                    Kapazität: {totalSelectedCapacity}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {selectedTablesData.map(t => (
                    <Badge key={t.id} variant="secondary" className="text-[9px] h-4">
                      {getTableDisplayName(t)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5 mt-2 justify-end">
              {(assignedTables.length > 0 || currentTableId) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={handleClear}
                  disabled={isSaving}
                >
                  Alle entfernen
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
                Abbrechen
              </Button>
              <Button
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={handleSave}
                disabled={isSaving || selectedTableIds.size === 0}
              >
                {isSaving ? (
                  <Loader2 className="h-2.5 w-2.5 mr-0.5 animate-spin" />
                ) : (
                  <Check className="h-2.5 w-2.5 mr-0.5" />
                )}
                Zuweisen {selectedTableIds.size > 0 ? `(${selectedTableIds.size})` : ''}
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }

  // Display mode - show assigned tables
  const hasAssignedTables = assignedTables.length > 0 || currentTableId;
  const isSeated = diningStatus === 'seated';
  
  return (
    <div 
      className={cn(
        "mt-1 flex items-center gap-2 cursor-pointer group/table",
        hasAssignedTables 
          ? "px-2 py-1 rounded-lg bg-rose-100 dark:bg-rose-900/30 border-2 border-rose-300 dark:border-rose-700 shadow-sm" 
          : ""
      )}
      onClick={(e) => {
        e.stopPropagation();
        handleStartEdit();
      }}
    >
      <Table2 className={cn(
        hasAssignedTables ? "h-4 w-4 text-rose-700 dark:text-rose-400" : "h-3 w-3 text-muted-foreground"
      )} />
      {assignedTables.length > 0 ? (
        <div className="flex items-center gap-1.5 flex-wrap flex-1">
          {assignedTables.slice(0, 4).map(t => (
            <Badge 
              key={t.id} 
              className="text-xs font-bold px-2 py-0.5 h-auto bg-rose-600 hover:bg-rose-700 text-white border-0 shadow-sm"
            >
              {t.table_number}
            </Badge>
          ))}
          {assignedTables.length > 4 && (
            <span className="text-xs font-medium text-rose-600 dark:text-rose-400">+{assignedTables.length - 4}</span>
          )}
        </div>
      ) : currentTableId && currentTableNumber ? (
        <Badge className="text-xs font-bold px-2 py-0.5 h-auto bg-rose-600 hover:bg-rose-700 text-white border-0 shadow-sm">
          {currentTableNumber}
        </Badge>
      ) : (
        <span className="text-xs text-muted-foreground group-hover/table:text-primary transition-colors">
          + Tische zuweisen
        </span>
      )}
      
      {/* Action button - checkmark to seat customer, shows "Seated" label after clicked */}
      {hasAssignedTables && (
        <div className="ml-auto flex items-center gap-1 flex-shrink-0">
          {isSeated ? (
            <Badge className="h-5 px-2 text-[10px] font-medium bg-green-100 text-green-800 border border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700">
              Reserviert
            </Badge>
          ) : (
            <button
              className="p-1 rounded hover:bg-rose-200 dark:hover:bg-rose-800/50 transition-colors"
              onClick={handleMarkReserved}
              disabled={isMarkingReserved}
              title="Klicken zum Platzieren"
            >
              {isMarkingReserved ? (
                <Loader2 className="h-4 w-4 animate-spin text-rose-700 dark:text-rose-400" />
              ) : (
                <Check className="h-4 w-4 text-rose-700 dark:text-rose-400" />
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
