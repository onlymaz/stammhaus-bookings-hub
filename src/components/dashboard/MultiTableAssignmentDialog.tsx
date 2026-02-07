import { useState, useEffect, useMemo } from "react";
import { useMultiTableAssignment } from "@/hooks/useMultiTableAssignment";
import { useTableManagement } from "@/hooks/useTableManagement";
import { RestaurantTable, TableZone } from "@/types/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Home, TreePine, Clock, Loader2, Check, Search, Building, Layers, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface MultiTableAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservationId: string;
  date: string;
  startTime: string;
  endTime?: string | null;
  guests: number;
  onAssigned?: () => void;
}

export const MultiTableAssignmentDialog = ({
  open,
  onOpenChange,
  reservationId,
  date,
  startTime,
  endTime,
  guests,
  onAssigned
}: MultiTableAssignmentDialogProps) => {
  const { tables, loading: tablesLoading } = useTableManagement();
  const { 
    loading: assigning,
    calculateEndTime,
    getAssignedTables,
    getAvailableTables,
    assignTables,
    releaseAllTables
  } = useMultiTableAssignment();

  const [availableTables, setAvailableTables] = useState<RestaurantTable[]>([]);
  const [selectedTableIds, setSelectedTableIds] = useState<Set<string>>(new Set());
  const [customEndTime, setCustomEndTime] = useState<string>("");
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [activeZone, setActiveZone] = useState<"all" | TableZone>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentlyAssigned, setCurrentlyAssigned] = useState<string[]>([]);

  const effectiveEndTime = customEndTime || endTime || calculateEndTime(startTime);

  // Fetch available tables and current assignments when dialog opens
  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, date, startTime]);

  const fetchData = async () => {
    setCheckingAvailability(true);
    
    // Get currently assigned tables
    const assigned = await getAssignedTables(reservationId);
    const assignedIds = assigned.map(a => a.table_id);
    setCurrentlyAssigned(assignedIds);
    setSelectedTableIds(new Set(assignedIds));

    // Get available tables
    const endTimeToCheck = customEndTime 
      ? `${customEndTime}:00`
      : endTime || calculateEndTime(startTime);
    
    const available = await getAvailableTables(date, startTime, endTimeToCheck, reservationId);
    
    // Include currently assigned tables even if they appear unavailable
    const allTables = [...available];
    for (const id of assignedIds) {
      if (!allTables.find(t => t.id === id)) {
        const table = tables.find(t => t.id === id);
        if (table) allTables.push(table);
      }
    }
    
    setAvailableTables(allTables);
    setCheckingAvailability(false);
    setSearchQuery("");
  };

  const handleEndTimeChange = (value: string) => {
    setCustomEndTime(value);
    setTimeout(() => fetchData(), 500);
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

  const handleAssign = async () => {
    const tableIds = Array.from(selectedTableIds);
    const endTimeToUse = customEndTime 
      ? `${customEndTime}:00`
      : endTime || calculateEndTime(startTime);

    const result = await assignTables(
      reservationId,
      tableIds,
      date,
      startTime,
      endTimeToUse
    );

    if (result.success) {
      toast.success(tableIds.length > 0 
        ? `${tableIds.length} Tisch${tableIds.length > 1 ? 'e' : ''} zugewiesen` 
        : "Tische entfernt"
      );
      onAssigned?.();
      onOpenChange(false);
    } else {
      toast.error(result.error || "Tische konnten nicht zugewiesen werden");
    }
  };

  const handleRelease = async () => {
    const success = await releaseAllTables(reservationId);
    if (success) {
      onAssigned?.();
      onOpenChange(false);
    }
  };

  const isTableAvailable = (tableId: string) => {
    return availableTables.some(t => t.id === tableId) || currentlyAssigned.includes(tableId);
  };

  const getTableDisplayName = (table: RestaurantTable) => table.table_number;

  const getTableNumeric = (tableNumber: string) => {
    const match = tableNumber.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  };

  const zoneOrder: Record<string, number> = { inside: 0, room: 1, garden: 2, mezz: 3 };

  const filteredTables = useMemo(() => {
    let result = tables.filter(t => t.is_active);
    
    if (activeZone !== "all") {
      result = result.filter(t => t.zone === activeZone);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t => {
        const displayName = getTableDisplayName(t).toLowerCase();
        return displayName.includes(query);
      });
    }
    
    return result.sort((a, b) => {
      const zoneA = zoneOrder[a.zone] ?? 99;
      const zoneB = zoneOrder[b.zone] ?? 99;
      if (zoneA !== zoneB) return zoneA - zoneB;
      return getTableNumeric(a.table_number) - getTableNumeric(b.table_number);
    });
  }, [tables, activeZone, searchQuery]);

  const selectedTables = tables.filter(t => selectedTableIds.has(t.id));
  const totalCapacity = selectedTables.reduce((sum, t) => sum + t.capacity, 0);
  const hasChanges = !setsEqual(selectedTableIds, new Set(currentlyAssigned));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Tische zuweisen
            <Badge variant="outline" className="ml-2">
              {selectedTableIds.size} ausgewählt
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Time Range */}
          <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{startTime.slice(0, 5)}</span>
            </div>
            <span className="text-muted-foreground">→</span>
            <div className="flex-1">
              <Input
                type="time"
                value={customEndTime || effectiveEndTime.slice(0, 5)}
                onChange={(e) => handleEndTimeChange(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>{guests} Gäste</span>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tisch suchen (z.B. T5, G12)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          {/* Zone Tabs */}
          <Tabs value={activeZone} onValueChange={(v) => setActiveZone(v as "all" | TableZone)}>
            <TabsList className="w-full grid grid-cols-5">
              <TabsTrigger value="all" className="text-xs">Alle</TabsTrigger>
              <TabsTrigger value="inside" className="text-xs gap-1">
                <Home className="h-3 w-3" />
                T
              </TabsTrigger>
              <TabsTrigger value="room" className="text-xs gap-1">
                <Building className="h-3 w-3" />
                R
              </TabsTrigger>
              <TabsTrigger value="garden" className="text-xs gap-1">
                <TreePine className="h-3 w-3" />
                G
              </TabsTrigger>
              <TabsTrigger value="mezz" className="text-xs gap-1">
                <Layers className="h-3 w-3" />
                M
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeZone} className="mt-4">
              {checkingAvailability ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 max-h-[250px] overflow-y-auto p-1">
                  {filteredTables.map(table => {
                    const available = isTableAvailable(table.id);
                    const isSelected = selectedTableIds.has(table.id);
                    const isCurrent = currentlyAssigned.includes(table.id);

                    return (
                      <button
                        key={table.id}
                        onClick={() => {
                          if (available || isCurrent) {
                            toggleTable(table.id);
                          }
                        }}
                        disabled={!available && !isCurrent}
                        className={cn(
                          "p-2 rounded-lg border-2 transition-all text-center relative",
                          isSelected && "border-primary bg-primary/10 shadow-md",
                          !isSelected && available && "border-border/50 hover:border-primary/50 bg-card",
                          !available && !isCurrent && "border-border/30 bg-muted/50 opacity-50 cursor-not-allowed"
                        )}
                      >
                        {isSelected && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                            <Check className="h-2.5 w-2.5 text-primary-foreground" />
                          </div>
                        )}
                        <span className="font-semibold text-sm">{getTableDisplayName(table)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Selection Summary */}
          {selectedTables.length > 0 && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Ausgewählte Tische</p>
                <Badge variant="secondary" className="text-xs">
                  Kapazität: {totalCapacity}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedTables.map(table => (
                  <Badge 
                    key={table.id} 
                    variant="outline"
                    className="gap-1 cursor-pointer hover:bg-destructive/10 hover:border-destructive/30"
                    onClick={() => toggleTable(table.id)}
                  >
                    {getTableDisplayName(table)}
                    <X className="h-3 w-3" />
                  </Badge>
                ))}
              </div>
              {totalCapacity < guests && (
                <p className="text-xs text-amber-600 mt-2">
                  ⚠️ Ausgewählte Kapazität ({totalCapacity}) ist geringer als Gästeanzahl ({guests})
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {currentlyAssigned.length > 0 && (
            <Button variant="outline" onClick={handleRelease} className="mr-auto" disabled={assigning}>
              Alle entfernen
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button 
            onClick={handleAssign} 
            disabled={assigning || !hasChanges}
          >
            {assigning && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {selectedTableIds.size > 0 
              ? `${selectedTableIds.size} Tisch${selectedTableIds.size > 1 ? 'e' : ''} zuweisen`
              : 'Tische entfernen'
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}
