import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Users, Phone, Mail, FileText, MessageSquare, Calendar } from "lucide-react";

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
}: ReservationDetailDialogProps) => {
  if (!reservation) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Reservation Details</span>
            <Badge className={getStatusBadgeClass(reservation.status)}>
              {reservation.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Customer Info */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Customer
            </h4>
            <div className="space-y-2">
              <p className="text-lg font-medium">
                {reservation.customer?.name || "Guest"}
              </p>
              {reservation.customer?.phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <a href={`tel:${reservation.customer.phone}`} className="hover:text-primary">
                    {reservation.customer.phone}
                  </a>
                </div>
              )}
              {reservation.customer?.email && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <a href={`mailto:${reservation.customer.email}`} className="hover:text-primary">
                    {reservation.customer.email}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Reservation Info */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Reservation
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {format(new Date(reservation.reservation_date), "MMM d, yyyy")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {reservation.reservation_time.slice(0, 5)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{reservation.guests} guests</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">
                  {reservation.source}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {reservation.notes && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Notes
              </h4>
              <p className="text-sm bg-muted/50 p-3 rounded-lg">
                {reservation.notes}
              </p>
            </div>
          )}

          {/* Special Requests */}
          {reservation.special_requests && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Special Requests
              </h4>
              <p className="text-sm bg-muted/50 p-3 rounded-lg">
                {reservation.special_requests}
              </p>
            </div>
          )}

          {/* Created At */}
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              Created: {format(new Date(reservation.created_at), "MMM d, yyyy 'at' h:mm a")}
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
