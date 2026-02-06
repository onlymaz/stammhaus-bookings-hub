import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, Loader2, Phone, Mail, User, Clock, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface TimeSlot {
  time: string;
  available: boolean;
}

interface ReservationToEdit {
  id: string;
  reservation_date: string;
  reservation_time: string;
  guests: number;
  status: string;
  notes: string | null;
  special_requests: string | null;
  customer: {
    name: string;
    phone: string;
    email: string | null;
  } | null;
}

interface EditReservationDialogProps {
  reservation: ReservationToEdit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
  onDelete?: () => void;
}

const GUEST_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export const EditReservationDialog = ({
  reservation,
  open,
  onOpenChange,
  onSave,
  onDelete,
}: EditReservationDialogProps) => {
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState<string>("");
  const [guests, setGuests] = useState<number>(2);
  const [customGuests, setCustomGuests] = useState<string>("");
  const [showCustomGuests, setShowCustomGuests] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [staffNote, setStaffNote] = useState("");
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!reservation) return;
    
    setIsDeleting(true);
    try {
      // First delete related table assignments
      await supabase
        .from("reservation_tables")
        .delete()
        .eq("reservation_id", reservation.id);

      // Then delete the reservation
      const { error } = await supabase
        .from("reservations")
        .delete()
        .eq("id", reservation.id);

      if (error) throw error;

      toast({
        title: "Reservierung gelöscht",
        description: "Die Reservierung wurde entfernt",
      });

      onDelete?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message || "Reservierung konnte nicht gelöscht werden",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Initialize form when reservation changes
  useEffect(() => {
    if (reservation && open) {
      setDate(new Date(reservation.reservation_date));
      setTime(reservation.reservation_time.slice(0, 5));
      setGuests(reservation.guests);
      setCustomerName(reservation.customer?.name || "");
      setCustomerPhone(reservation.customer?.phone || "");
      setCustomerEmail(reservation.customer?.email || "");
      setSpecialRequests(reservation.special_requests || "");
      setStaffNote(reservation.notes || "");
      
      if (reservation.guests > 10) {
        setShowCustomGuests(true);
        setCustomGuests(reservation.guests.toString());
      } else {
        setShowCustomGuests(false);
        setCustomGuests("");
      }
    }
  }, [reservation, open]);

  const handleGuestSelect = (num: number) => {
    setGuests(num);
    setShowCustomGuests(false);
    setCustomGuests("");
  };

  const handleCustomGuestsChange = (value: string) => {
    setCustomGuests(value);
    const num = parseInt(value);
    if (!isNaN(num) && num >= 1 && num <= 500) {
      setGuests(num);
    }
  };

  useEffect(() => {
    if (date) {
      generateTimeSlots(date);
    }
  }, [date]);

  const generateTimeSlots = async (selectedDate: Date) => {
    setLoadingSlots(true);
    const dayOfWeek = selectedDate.getDay();

    const [hoursResult, capacityResult] = await Promise.all([
      supabase
        .from("operating_hours")
        .select("*")
        .eq("day_of_week", dayOfWeek)
        .maybeSingle(),
      supabase
        .from("capacity_settings")
        .select("slot_duration_minutes")
        .limit(1)
        .maybeSingle()
    ]);

    const hours = hoursResult.data;
    const slotDuration = capacityResult.data?.slot_duration_minutes || 15;

    const defaultHours = {
      lunch_start: "11:00",
      lunch_end: "22:00",
      dinner_start: null,
      dinner_end: null,
      is_closed: false,
    };

    const operatingHours = hours || defaultHours;

    if (operatingHours.is_closed) {
      setTimeSlots([]);
      setLoadingSlots(false);
      return;
    }

    const slots: TimeSlot[] = [];
    
    if (operatingHours.lunch_start && operatingHours.lunch_end) {
      const lunchSlots = generateSlotsForPeriod(operatingHours.lunch_start, operatingHours.lunch_end, slotDuration);
      slots.push(...lunchSlots);
    }

    if (operatingHours.dinner_start && operatingHours.dinner_end) {
      const dinnerSlots = generateSlotsForPeriod(operatingHours.dinner_start, operatingHours.dinner_end, slotDuration);
      slots.push(...dinnerSlots);
    }

    setTimeSlots(slots);
    setLoadingSlots(false);
  };

  const generateSlotsForPeriod = (start: string, end: string, slotDuration: number): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    const [startHour, startMin] = start.split(":").map(Number);
    const [endHour, endMin] = end.split(":").map(Number);
    
    let currentHour = startHour;
    let currentMin = startMin;

    while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
      const timeStr = `${currentHour.toString().padStart(2, "0")}:${currentMin.toString().padStart(2, "0")}`;
      slots.push({ time: timeStr, available: true });

      currentMin += slotDuration;
      if (currentMin >= 60) {
        currentHour += Math.floor(currentMin / 60);
        currentMin = currentMin % 60;
      }
    }

    return slots;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reservation || !date || !time || !customerName) {
      toast({
        title: "Fehlende Informationen",
        description: "Bitte füllen Sie alle erforderlichen Felder aus",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Update customer information
      if (reservation.customer) {
        const customerUpdates: { name?: string; phone?: string; email?: string | null } = {};
        
        if (reservation.customer.name !== customerName) {
          customerUpdates.name = customerName;
        }
        if (reservation.customer.phone !== customerPhone) {
          customerUpdates.phone = customerPhone || "";
        }
        if (reservation.customer.email !== (customerEmail || null)) {
          customerUpdates.email = customerEmail || null;
        }

        if (Object.keys(customerUpdates).length > 0) {
          // Get customer_id from reservation
          const { data: reservationData } = await supabase
            .from("reservations")
            .select("customer_id")
            .eq("id", reservation.id)
            .single();

          if (reservationData) {
            await supabase
              .from("customers")
              .update(customerUpdates)
              .eq("id", reservationData.customer_id);
          }
        }
      }

      // Update reservation
      const { error: reservationError } = await supabase
        .from("reservations")
        .update({
          reservation_date: format(date, "yyyy-MM-dd"),
          reservation_time: time + ":00",
          guests: guests,
          special_requests: specialRequests || null,
          notes: staffNote || null,
        })
        .eq("id", reservation.id);

      if (reservationError) throw reservationError;

      toast({
        title: "Reservierung aktualisiert",
        description: `Buchung aktualisiert für ${customerName} am ${format(date, "d. MMM")} um ${time}`,
      });

      onSave?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message || "Reservierung konnte nicht aktualisiert werden",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!reservation) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Reservierung bearbeiten
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Date & Time Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Datum *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "d. MMM yyyy") : "Datum wählen"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[100] bg-background" align="start" sideOffset={4}>
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Zeit *</Label>
              {loadingSlots ? (
                <div className="h-10 flex items-center justify-center text-sm text-muted-foreground">
                  Laden...
                </div>
              ) : timeSlots.length === 0 ? (
                <div className="h-10 flex items-center justify-center text-sm text-muted-foreground">
                  Geschlossen
                </div>
              ) : (
                <Select value={time} onValueChange={setTime}>
                  <SelectTrigger className="w-full">
                    <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Zeit wählen" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px] z-[100] bg-background" position="popper" sideOffset={4}>
                    {timeSlots.filter(slot => slot.available).map((slot) => (
                      <SelectItem key={slot.time} value={slot.time}>
                        {slot.time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Guest Selection */}
          <div className="space-y-2">
            <Label>Anzahl Gäste *</Label>
            
            <div className="flex flex-wrap gap-1.5">
              {GUEST_OPTIONS.map((num) => (
                <Button
                  key={num}
                  type="button"
                  variant={guests === num && !showCustomGuests ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "text-sm h-10 w-10 font-medium transition-all",
                    guests === num && !showCustomGuests && "shadow-md"
                  )}
                  onClick={() => handleGuestSelect(num)}
                >
                  {num}
                </Button>
              ))}
              <Button
                type="button"
                variant={showCustomGuests ? "secondary" : "outline"}
                size="sm"
                className={cn(
                  "text-sm h-10 px-3 font-medium transition-all",
                  showCustomGuests && "bg-accent text-accent-foreground shadow-md"
                )}
                onClick={() => setShowCustomGuests(true)}
              >
              Individuell
              </Button>
            </div>
            
            {showCustomGuests && (
              <div className="flex items-center gap-2 mt-2">
                <Input
                  type="number"
                  min={1}
                  max={500}
                  placeholder="Anzahl eingeben"
                  value={customGuests}
                  onChange={(e) => handleCustomGuestsChange(e.target.value)}
                  className="max-w-[140px]"
                  autoFocus
                />
                <span className="text-sm text-muted-foreground">Gäste</span>
              </div>
            )}
          </div>

          {/* Customer Details */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground">
              Kundendetails
            </h3>

            <div className="space-y-2">
              <Label htmlFor="edit-name">Name *</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="edit-name"
                  placeholder="Kundenname"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-phone">Telefon (optional)</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="edit-phone"
                  type="tel"
                  placeholder="+49 123 456 7890"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-email">E-Mail (optional)</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="edit-email"
                  type="email"
                  placeholder="customer@email.com"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* Special Requests */}
          <div className="space-y-2">
            <Label htmlFor="edit-requests">Sonderwünsche</Label>
            <Textarea
              id="edit-requests"
              placeholder="Allergien, Anlass, Sitzplatzwünsche..."
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              rows={2}
            />
          </div>

          {/* Staff Note */}
          <div className="space-y-2">
            <Label htmlFor="edit-note">Mitarbeiternotiz</Label>
            <Textarea
              id="edit-note"
              placeholder="Interne Notizen für Mitarbeiter..."
              value={staffNote}
              onChange={(e) => setStaffNote(e.target.value)}
              rows={2}
            />
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-4">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="z-[110]">
                <AlertDialogHeader>
                  <AlertDialogTitle>Reservierung löschen</AlertDialogTitle>
                  <AlertDialogDescription>
                    Sind Sie sicher, dass Sie diese Reservierung für {customerName} löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Löschen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Abbrechen
            </Button>
            <Button type="submit" className="flex-1" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Speichern...
                </>
              ) : (
                "Änderungen speichern"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
