import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { CalendarIcon, Loader2, Users, Phone, Mail, User, Clock } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface CreateReservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TimeSlot {
  time: string;
  available: boolean;
}

// Guest options - Numbers 1-10 as preset, then custom input for larger groups
const GUEST_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export const CreateReservationDialog = ({
  open,
  onOpenChange,
}: CreateReservationDialogProps) => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [time, setTime] = useState<string>("");
  const [guests, setGuests] = useState<number>(2);
  const [customGuests, setCustomGuests] = useState<string>("");
  const [showCustomGuests, setShowCustomGuests] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const { toast } = useToast();

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

    // Fetch operating hours and capacity settings in parallel
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

    // If no operating hours set, use defaults (11:00 - 22:00)
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
    
    // Generate lunch slots (main period)
    if (operatingHours.lunch_start && operatingHours.lunch_end) {
      const lunchSlots = generateSlotsForPeriod(operatingHours.lunch_start, operatingHours.lunch_end, slotDuration);
      slots.push(...lunchSlots);
    }

    // Generate dinner slots (if separate dinner period exists)
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

    if (!date || !time || !customerName || !customerPhone) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Create or find customer
      const { data: existingCustomer } = await supabase
        .from("customers")
        .select("id")
        .eq("phone", customerPhone)
        .maybeSingle();

      let customerId = existingCustomer?.id;

      if (!customerId) {
        const { data: newCustomer, error: customerError } = await supabase
          .from("customers")
          .insert({
            name: customerName,
            phone: customerPhone,
            email: customerEmail || null,
          })
          .select("id")
          .single();

        if (customerError) throw customerError;
        customerId = newCustomer.id;
      }

      // Create reservation
      const { error: reservationError } = await supabase
        .from("reservations")
        .insert({
          customer_id: customerId,
          reservation_date: format(date, "yyyy-MM-dd"),
          reservation_time: time + ":00",
          guests: guests,
          source: "phone",
          special_requests: specialRequests || null,
        });

      if (reservationError) throw reservationError;

      toast({
        title: "Reservation created",
        description: `Booking confirmed for ${customerName} on ${format(date, "MMM d")} at ${time}`,
      });

      // Reset form
      setCustomerName("");
      setCustomerPhone("");
      setCustomerEmail("");
      setSpecialRequests("");
      setTime("");
      setGuests(2);
      setCustomGuests("");
      setShowCustomGuests(false);
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create reservation",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            New Reservation
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Date & Time Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date *</Label>
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
                    {date ? format(date, "MMM d, yyyy") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
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
              <Label>Selected</Label>
              <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted/50">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{guests}</span>
                <span className="text-muted-foreground text-sm">
                  {guests === 1 ? "guest" : "guests"}
                </span>
              </div>
            </div>
          </div>

          {/* Guest Selection */}
          <div className="space-y-2">
            <Label>Number of Guests *</Label>
            
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
                Custom
              </Button>
            </div>
            
            {showCustomGuests && (
              <div className="flex items-center gap-2 mt-2">
                <Input
                  type="number"
                  min={1}
                  max={500}
                  placeholder="Enter number"
                  value={customGuests}
                  onChange={(e) => handleCustomGuestsChange(e.target.value)}
                  className="max-w-[140px]"
                  autoFocus
                />
                <span className="text-sm text-muted-foreground">guests</span>
              </div>
            )}
          </div>

          {/* Time Slots */}
          <div className="space-y-2">
            <Label>Time *</Label>
            {loadingSlots ? (
              <div className="py-4 text-center text-muted-foreground">
                Loading available times...
              </div>
            ) : timeSlots.length === 0 ? (
              <div className="py-4 text-center text-muted-foreground border rounded-lg">
                No available times for this date
              </div>
            ) : (
              <Select value={time} onValueChange={setTime}>
                <SelectTrigger className="w-full">
                  <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Select a time" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {timeSlots.filter(slot => slot.available).map((slot) => (
                    <SelectItem key={slot.time} value={slot.time}>
                      {slot.time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Customer Details */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground">
              Customer Details
            </h3>

            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  placeholder="Customer name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone *</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+49 123 456 7890"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email (optional)</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
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
            <Label htmlFor="requests">Special Requests</Label>
            <Textarea
              id="requests"
              placeholder="Allergies, occasion, seating preferences..."
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              rows={3}
            />
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Reservation"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
