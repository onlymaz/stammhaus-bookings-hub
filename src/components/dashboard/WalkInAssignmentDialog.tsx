import { useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Users, Phone, User, Loader2, Clock } from "lucide-react";
import { toast } from "sonner";
import { TableZone } from "@/types/table";

interface WalkInAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table: {
    id: string;
    table_number: string;
    zone: TableZone;
    capacity: number;
  } | null;
  selectedDate: Date;
  onSuccess?: () => void;
}

const DEFAULT_DURATION_MINUTES = 120;

export const WalkInAssignmentDialog = ({
  open,
  onOpenChange,
  table,
  selectedDate,
  onSuccess
}: WalkInAssignmentDialogProps) => {
  const [customerName, setCustomerName] = useState("Walk-in Customer");
  const [phone, setPhone] = useState("");
  const [guests, setGuests] = useState(2);
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setCustomerName("Walk-in Customer");
    setPhone("");
    setGuests(2);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const calculateEndTime = (startTime: string): string => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + DEFAULT_DURATION_MINUTES;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMins = totalMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}:00`;
  };

  const handleAssign = async () => {
    if (!table) {
      toast.error("No table selected");
      return;
    }

    setSaving(true);

    try {
      // Current time as start time
      const now = new Date();
      const startTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:00`;
      const endTime = calculateEndTime(startTime);
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      
      // Use default name if empty
      const finalName = customerName.trim() || "Walk-in Customer";

      // Create or find customer
      let customerId: string;
      
      // Try to find existing customer by phone (if provided) or create new
      if (phone.trim()) {
        const { data: existingCustomer } = await supabase
          .from("customers")
          .select("id")
          .eq("phone", phone.trim())
          .maybeSingle();

        if (existingCustomer) {
          customerId = existingCustomer.id;
          // Update name if different and not default
          if (finalName !== "Walk-in Customer") {
            await supabase
              .from("customers")
              .update({ name: finalName })
              .eq("id", customerId);
          }
        } else {
          // Create new customer
          const { data: newCustomer, error: customerError } = await supabase
            .from("customers")
            .insert({
              name: finalName,
              phone: phone.trim() || "walk-in"
            })
            .select("id")
            .single();

          if (customerError) throw customerError;
          customerId = newCustomer.id;
        }
      } else {
        // No phone - create new customer with placeholder
        const { data: newCustomer, error: customerError } = await supabase
          .from("customers")
          .insert({
            name: finalName,
            phone: `walk-in-${Date.now()}`
          })
          .select("id")
          .single();

        if (customerError) throw customerError;
        customerId = newCustomer.id;
      }

      // Create reservation with dining_status 'seated' for walk-ins
      const { data: reservation, error: resError } = await supabase
        .from("reservations")
        .insert({
          customer_id: customerId,
          reservation_date: dateStr,
          reservation_time: startTime,
          reservation_end_time: endTime,
          guests: guests,
          source: "walk-in",
          status: "confirmed",
          dining_status: "seated",
          assigned_table_id: table.id,
          notes: "Walk-in customer"
        })
        .select("id")
        .single();

      if (resError) throw resError;

      // Also add to reservation_tables junction
      await supabase
        .from("reservation_tables")
        .insert({
          reservation_id: reservation.id,
          table_id: table.id
        });

      toast.success(`${customerName} seated at ${table.table_number}`);
      handleClose();
      onSuccess?.();
    } catch (error: any) {
      console.error("Error creating walk-in:", error);
      toast.error(error.message || "Failed to seat customer");
    } finally {
      setSaving(false);
    }
  };

  // Get display name without leading zeros
  const getTableDisplayName = () => {
    if (!table) return "";
    const raw = table.table_number;
    const m = raw.match(/^([A-Za-z]+)0*(\d+)$/);
    if (!m) return raw;
    return `${m[1]}${parseInt(m[2], 10)}`;
  };

  // Current time display
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  const endTimeDisplay = calculateEndTime(currentTime + ':00').slice(0, 5);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Seat Walk-In Customer
            {table && (
              <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary">
                {getTableDisplayName()}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Time info */}
          <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              <strong>{currentTime}</strong> → <strong>{endTimeDisplay}</strong>
              <span className="text-muted-foreground ml-2">(2 hours)</span>
            </span>
            {table && (
              <Badge variant="outline" className="ml-auto text-xs">
                Capacity: {table.capacity}
              </Badge>
            )}
          </div>

          {/* Customer Name (optional) */}
          <div className="space-y-2">
            <Label htmlFor="customer-name" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Customer Name <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Input
              id="customer-name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Enter customer name"
              autoFocus
            />
          </div>

          {/* Phone (optional) */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Phone <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number"
            />
          </div>

          {/* Guests */}
          <div className="space-y-2">
            <Label htmlFor="guests" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Number of Guests
            </Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setGuests(Math.max(1, guests - 1))}
                disabled={guests <= 1}
              >
                -
              </Button>
              <Input
                id="guests"
                type="number"
                min={1}
                max={20}
                value={guests}
                onChange={(e) => setGuests(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 text-center"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setGuests(Math.min(20, guests + 1))}
                disabled={guests >= 20}
              >
                +
              </Button>
              {table && guests > table.capacity && (
                <span className="text-xs text-warning">
                  Exceeds capacity ({table.capacity})
                </span>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Seat Customer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
