import { format } from "date-fns";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Users, Phone, Mail, FileText, MessageSquare, Calendar, CheckCircle, XCircle, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ReservationDetail {
  id: string;
  reservation_date: string;
  reservation_time: string;
  guests: number;
  status: string;
  notes: string | null;
  special_requests: string | null;
  source: string;
  created_at: string;
  customer: {
    name: string;
    phone: string;
    email: string | null;
  } | null;
}

interface ReservationDetailDialogProps {
  reservation: ReservationDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange?: () => void;
}

const getStatusBadgeClass = (status: string) => {
  const statusClasses: Record<string, string> = {
    new: "status-new",
    confirmed: "status-confirmed",
    completed: "status-completed",
    cancelled: "status-cancelled",
    no_show: "status-no_show",
  };
  return statusClasses[status] || "bg-muted text-muted-foreground";
};

export const ReservationDetailDialog = ({
  reservation,
  open,
  onOpenChange,
  onStatusChange,
}: ReservationDetailDialogProps) => {
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();

  if (!reservation) return null;

  const updateStatus = async (newStatus: string) => {
    setUpdating(true);
    const { error } = await supabase
      .from("reservations")
      .update({ status: newStatus })
      .eq("id", reservation.id);

    setUpdating(false);

    if (error) {
      toast({ title: "Error updating status", variant: "destructive" });
    } else {
      toast({ title: `Reservation ${newStatus}` });
      onStatusChange?.();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden border-0 shadow-2xl">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-primary/15 via-card to-accent/15 px-6 py-5 border-b border-border/30">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
                  <Users className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-display font-bold">
                    {reservation.customer?.name || "Guest"}
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Reservation Details
                  </p>
                </div>
              </div>
              <Badge className={cn(getStatusBadgeClass(reservation.status), "text-sm font-semibold px-3 py-1.5 rounded-lg")}>
                {reservation.status}
              </Badge>
            </div>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-6">
          {/* Contact Info */}
          <div className="grid grid-cols-2 gap-4">
            {reservation.customer?.phone && (
              <a 
                href={`tel:${reservation.customer.phone}`} 
                className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-secondary/50 to-secondary/30 border border-border/30 hover:border-primary/30 transition-all duration-300 hover:shadow-md group"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Phone className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="font-medium text-sm">{reservation.customer.phone}</p>
                </div>
              </a>
            )}
            {reservation.customer?.email && (
              <a 
                href={`mailto:${reservation.customer.email}`} 
                className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-secondary/50 to-secondary/30 border border-border/30 hover:border-primary/30 transition-all duration-300 hover:shadow-md group"
              >
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                  <Mail className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium text-sm truncate">{reservation.customer.email}</p>
                </div>
              </a>
            )}
          </div>

          {/* Reservation Info */}
          <div className="grid grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 text-center">
              <Calendar className="h-5 w-5 text-primary mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Date</p>
              <p className="font-bold text-sm">{format(new Date(reservation.reservation_date), "MMM d")}</p>
            </div>
            <div className="p-4 rounded-xl bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20 text-center">
              <Clock className="h-5 w-5 text-accent mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Time</p>
              <p className="font-bold text-sm">{reservation.reservation_time.slice(0, 5)}</p>
            </div>
            <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 text-center">
              <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Guests</p>
              <p className="font-bold text-sm">{reservation.guests}</p>
            </div>
            <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20 text-center">
              <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Source</p>
              <p className="font-bold text-sm capitalize">{reservation.source}</p>
            </div>
          </div>

          {/* Notes */}
          {reservation.notes && (
            <div className="p-4 rounded-xl bg-gradient-to-br from-secondary/60 to-secondary/30 border border-border/30">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold text-muted-foreground">Notes</h4>
              </div>
              <p className="text-sm text-foreground">{reservation.notes}</p>
            </div>
          )}

          {/* Special Requests */}
          {reservation.special_requests && (
            <div className="p-4 rounded-xl bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-4 w-4 text-accent" />
                <h4 className="text-sm font-semibold text-accent">Special Requests</h4>
              </div>
              <p className="text-sm text-foreground">{reservation.special_requests}</p>
            </div>
          )}

          {/* Status Actions */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Change Status</h4>
            <div className="grid grid-cols-2 gap-2">
              {reservation.status !== "confirmed" && (
                <Button
                  variant="outline"
                  className="gap-2 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
                  onClick={() => updateStatus("confirmed")}
                  disabled={updating}
                >
                  <CheckCircle className="h-4 w-4" />
                  Confirm
                </Button>
              )}
              {reservation.status !== "completed" && (
                <Button
                  variant="outline"
                  className="gap-2 border-blue-500/30 text-blue-600 hover:bg-blue-500/10 hover:text-blue-700"
                  onClick={() => updateStatus("completed")}
                  disabled={updating}
                >
                  <CheckCircle className="h-4 w-4" />
                  Complete
                </Button>
              )}
              {reservation.status !== "cancelled" && (
                <Button
                  variant="outline"
                  className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
                  onClick={() => updateStatus("cancelled")}
                  disabled={updating}
                >
                  <XCircle className="h-4 w-4" />
                  Cancel
                </Button>
              )}
              {reservation.status !== "no_show" && (
                <Button
                  variant="outline"
                  className="gap-2 border-orange-500/30 text-orange-600 hover:bg-orange-500/10 hover:text-orange-700"
                  onClick={() => updateStatus("no_show")}
                  disabled={updating}
                >
                  <UserX className="h-4 w-4" />
                  No Show
                </Button>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-border/30">
            <p className="text-xs text-muted-foreground">
              Created {format(new Date(reservation.created_at), "MMM d, yyyy 'at' h:mm a")}
            </p>
            <Button 
              onClick={() => onOpenChange(false)}
              className="px-6 shadow-md hover:shadow-lg transition-all duration-300"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
