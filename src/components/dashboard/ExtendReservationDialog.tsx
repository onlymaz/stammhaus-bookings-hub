import { useState } from "react";
import { useTableManagement } from "@/hooks/useTableManagement";
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
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ExtendReservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservationId: string;
  tableId: string;
  tableName: string;
  date: string;
  currentStartTime: string;
  currentEndTime: string;
  onExtended?: () => void;
}

export const ExtendReservationDialog = ({
  open,
  onOpenChange,
  reservationId,
  tableId,
  tableName,
  date,
  currentStartTime,
  currentEndTime,
  onExtended
}: ExtendReservationDialogProps) => {
  const { extendReservation } = useTableManagement();

  const [newEndTime, setNewEndTime] = useState(currentEndTime.slice(0, 5));
  const [extending, setExtending] = useState(false);
  const [conflictDialog, setConflictDialog] = useState(false);
  const [conflictMessage, setConflictMessage] = useState("");

  // Generate time options (30 min increments from current end time)
  const generateTimeOptions = () => {
    const options: string[] = [];
    const [hours, minutes] = currentEndTime.split(':').map(Number);
    let totalMinutes = hours * 60 + minutes;

    // Add 4 hours of options
    for (let i = 0; i < 8; i++) {
      totalMinutes += 30;
      const h = Math.floor(totalMinutes / 60) % 24;
      const m = totalMinutes % 60;
      options.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    }

    return options;
  };

  const timeOptions = generateTimeOptions();

  const handleExtend = async () => {
    if (!newEndTime || newEndTime <= currentEndTime.slice(0, 5)) {
      toast.error("Neue Endzeit muss später als aktuelle Endzeit sein");
      return;
    }

    setExtending(true);
    const result = await extendReservation(
      reservationId,
      tableId,
      date,
      currentStartTime,
      `${newEndTime}:00`
    );

    setExtending(false);

    if (result.success) {
      toast.success("Reservierung erfolgreich verlängert");
      onExtended?.();
      onOpenChange(false);
    } else if (result.conflict) {
      setConflictMessage(result.error || "Verlängerung nicht möglich aufgrund eines Konflikts.");
      setConflictDialog(true);
    } else {
      toast.error(result.error || "Reservierung konnte nicht verlängert werden");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reservierung verlängern</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Tisch</span>
                <span className="font-medium">{tableName}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Aktuelle Zeit</span>
                <span className="font-medium flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" />
                  {currentStartTime.slice(0, 5)} - {currentEndTime.slice(0, 5)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Neue Endzeit</Label>
              <div className="flex gap-2">
                <Input
                  type="time"
                  value={newEndTime}
                  onChange={(e) => setNewEndTime(e.target.value)}
                  min={currentEndTime.slice(0, 5)}
                  className="flex-1"
                />
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {timeOptions.map(time => (
                  <Button
                    key={time}
                    variant={newEndTime === time ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNewEndTime(time)}
                    className="text-xs"
                  >
                    {time}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button 
              onClick={handleExtend} 
              disabled={extending || newEndTime <= currentEndTime.slice(0, 5)}
            >
              {extending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Verlängern bis {newEndTime}
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
              Verlängerung nicht möglich
            </AlertDialogTitle>
            <AlertDialogDescription>
              {conflictMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setConflictDialog(false)}>
              Verstanden
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
