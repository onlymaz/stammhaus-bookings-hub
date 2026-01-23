import { useState, useEffect } from "react";
import { useTableManagement } from "@/hooks/useTableManagement";
import { RestaurantTable, TableZone } from "@/types/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Home, TreePine, Clock, AlertTriangle, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface TableAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservationId: string;
  date: string;
  startTime: string;
  endTime?: string | null;
  guests: number;
  currentTableId?: string | null;
  onAssigned?: () => void;
}

export const TableAssignmentDialog = ({
  open,
  onOpenChange,
  reservationId,
  date,
  startTime,
  endTime,
  guests,
  currentTableId,
  onAssigned
}: TableAssignmentDialogProps) => {
  const { 
    tables,
    loading,
    calculateEndTime,
    getAvailableTables,
    assignTable,
    releaseTable
  } = useTableManagement();

  const [availableTables, setAvailableTables] = useState<RestaurantTable[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [customEndTime, setCustomEndTime] = useState<string>("");
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [conflictDialog, setConflictDialog] = useState(false);
  const [conflictMessage, setConflictMessage] = useState("");
  const [activeZone, setActiveZone] = useState<"all" | TableZone>("all");

  const effectiveEndTime = customEndTime || endTime || calculateEndTime(startTime);

  // Fetch available tables when dialog opens or time changes
  useEffect(() => {
    if (open) {
      fetchAvailableTables();
      setSelectedTableId(currentTableId || null);
      setCustomEndTime(endTime?.slice(0, 5) || "");
    }
  }, [open, date, startTime]);

  const fetchAvailableTables = async () => {
    setCheckingAvailability(true);
    const endTimeToCheck = customEndTime 
      ? `${customEndTime}:00`
      : endTime || calculateEndTime(startTime);
    
    const available = await getAvailableTables(date, startTime, endTimeToCheck);
    setAvailableTables(available);
    setCheckingAvailability(false);
  };

  // Re-check when end time changes
  const handleEndTimeChange = (value: string) => {
    setCustomEndTime(value);
    // Debounce the availability check
    setTimeout(() => fetchAvailableTables(), 500);
  };

  const handleAssign = async () => {
    if (!selectedTableId) return;

    setAssigning(true);
    const endTimeToUse = customEndTime 
      ? `${customEndTime}:00`
      : endTime || calculateEndTime(startTime);

    const result = await assignTable(
      reservationId,
      selectedTableId,
      date,
      startTime,
      endTimeToUse
    );

    setAssigning(false);

    if (result.success) {
      toast.success("Table assigned successfully");
      onAssigned?.();
      onOpenChange(false);
    } else if (result.conflict) {
      setConflictMessage(result.error || "This table has a conflicting reservation.");
      setConflictDialog(true);
    } else {
      toast.error(result.error || "Failed to assign table");
    }
  };

  const handleRelease = async () => {
    const success = await releaseTable(reservationId);
    if (success) {
      onAssigned?.();
      onOpenChange(false);
    }
  };

  const isTableAvailable = (tableId: string) => {
    return availableTables.some(t => t.id === tableId);
  };

  const filteredTables = activeZone === "all" 
    ? tables.filter(t => t.is_active)
    : tables.filter(t => t.is_active && t.zone === activeZone);

  const selectedTable = tables.find(t => t.id === selectedTableId);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Assign Table
              {currentTableId && (
                <Badge variant="outline" className="ml-2">
                  Currently: {tables.find(t => t.id === currentTableId)?.table_number}
                </Badge>
              )}
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
                <span>{guests} guests</span>
              </div>
            </div>

            {/* Zone Tabs */}
            <Tabs value={activeZone} onValueChange={(v) => setActiveZone(v as "all" | TableZone)}>
              <TabsList className="w-full">
                <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
                <TabsTrigger value="inside" className="flex-1 gap-1.5">
                  <Home className="h-3.5 w-3.5" />
                  Inside
                </TabsTrigger>
                <TabsTrigger value="garden" className="flex-1 gap-1.5">
                  <TreePine className="h-3.5 w-3.5" />
                  Garden
                </TabsTrigger>
              </TabsList>

              <TabsContent value={activeZone} className="mt-4">
                {checkingAvailability ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto p-1">
                    {filteredTables.map(table => {
                      const available = isTableAvailable(table.id);
                      const isSelected = selectedTableId === table.id;
                      const isCurrent = currentTableId === table.id;
                      const meetsCapacity = table.capacity >= guests;

                      return (
                        <button
                          key={table.id}
                          onClick={() => {
                            if (available || isCurrent) {
                              setSelectedTableId(table.id);
                            }
                          }}
                          disabled={!available && !isCurrent}
                          className={cn(
                            "p-3 rounded-lg border-2 transition-all text-left relative",
                            isSelected && "border-primary bg-primary/10 shadow-md",
                            !isSelected && available && "border-border/50 hover:border-primary/50 bg-card",
                            !available && !isCurrent && "border-border/30 bg-muted/50 opacity-50 cursor-not-allowed",
                            isCurrent && !isSelected && "border-accent/50 bg-accent/5"
                          )}
                        >
                          {isSelected && (
                            <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                              <Check className="h-3 w-3 text-primary-foreground" />
                            </div>
                          )}
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-sm">{table.table_number}</span>
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-[10px]",
                                table.zone === 'inside' 
                                  ? "border-blue-500/30 text-blue-600"
                                  : "border-green-500/30 text-green-600"
                              )}
                            >
                              {table.zone === 'inside' ? <Home className="h-2.5 w-2.5" /> : <TreePine className="h-2.5 w-2.5" />}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Users className="h-3 w-3" />
                            <span className={cn(!meetsCapacity && "text-amber-600")}>{table.capacity}</span>
                            {!meetsCapacity && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                          </div>
                          {isCurrent && (
                            <Badge className="mt-1.5 text-[9px]" variant="secondary">Current</Badge>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {/* Selection Summary */}
            {selectedTable && (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm">
                  <strong>Selected:</strong> Table {selectedTable.table_number} ({selectedTable.capacity} seats, {selectedTable.zone})
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            {currentTableId && (
              <Button variant="outline" onClick={handleRelease} className="mr-auto">
                Release Table
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAssign} 
              disabled={!selectedTableId || assigning || (selectedTableId === currentTableId)}
            >
              {assigning && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Assign Table
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Conflict Alert */}
      <AlertDialog open={conflictDialog} onOpenChange={setConflictDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Table Conflict
            </AlertDialogTitle>
            <AlertDialogDescription>
              {conflictMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setConflictDialog(false)}>
              Select Another Table
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
