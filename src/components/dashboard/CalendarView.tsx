import { useState, useEffect } from "react";
import { format, startOfWeek, addDays, isSameDay, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus, Users, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Reservation {
  id: string;
  reservation_date: string;
  reservation_time: string;
  guests: number;
  status: string;
  customer: {
    name: string;
    phone: string;
  } | null;
}

interface CalendarViewProps {
  onCreateReservation: () => void;
}

export const CalendarView = ({ onCreateReservation }: CalendarViewProps) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));

  useEffect(() => {
    fetchReservations();
  }, [weekStart]);

  const fetchReservations = async () => {
    setLoading(true);
    const weekEnd = addDays(weekStart, 6);
    
    const { data, error } = await supabase
      .from("reservations")
      .select(`
        id,
        reservation_date,
        reservation_time,
        guests,
        status,
        customer:customers(name, phone)
      `)
      .gte("reservation_date", format(weekStart, "yyyy-MM-dd"))
      .lte("reservation_date", format(weekEnd, "yyyy-MM-dd"))
      .order("reservation_time", { ascending: true });

    if (!error && data) {
      setReservations(data as Reservation[]);
    }
    setLoading(false);
  };

  const getReservationsForDate = (date: Date) => {
    return reservations.filter((r) =>
      isSameDay(parseISO(r.reservation_date), date)
    );
  };

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

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const todayReservations = getReservationsForDate(selectedDate);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Week View */}
      <div className="lg:col-span-2">
        <Card className="card-elevated">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="font-display text-lg">
              {format(weekStart, "MMMM yyyy")}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setWeekStart(addDays(weekStart, -7))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setWeekStart(addDays(weekStart, 7))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map((day) => {
                const dayReservations = getReservationsForDate(day);
                const isSelected = isSameDay(day, selectedDate);
                const isToday = isSameDay(day, new Date());

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      "p-3 rounded-lg text-left transition-all min-h-[120px] border",
                      isSelected
                        ? "bg-primary/10 border-primary"
                        : "bg-card border-border hover:border-primary/50",
                      isToday && !isSelected && "ring-2 ring-accent ring-offset-2"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground">
                        {format(day, "EEE")}
                      </span>
                      <span
                        className={cn(
                          "text-sm font-medium",
                          isToday && "text-accent"
                        )}
                      >
                        {format(day, "d")}
                      </span>
                    </div>
                    {dayReservations.length > 0 && (
                      <div className="space-y-1">
                        {dayReservations.slice(0, 3).map((res) => (
                          <div
                            key={res.id}
                            className="text-xs bg-primary/10 text-primary rounded px-1.5 py-0.5 truncate"
                          >
                            {res.reservation_time.slice(0, 5)} · {res.customer?.name || "Guest"}
                          </div>
                        ))}
                        {dayReservations.length > 3 && (
                          <div className="text-xs text-muted-foreground">
                            +{dayReservations.length - 3} more
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Day Detail */}
      <div>
        <Card className="card-elevated">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="font-display text-lg">
                {format(selectedDate, "EEEE")}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {format(selectedDate, "MMMM d, yyyy")}
              </p>
            </div>
            <Button size="sm" onClick={onCreateReservation} className="gap-1">
              <Plus className="h-3 w-3" />
              Add
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">
                Loading...
              </div>
            ) : todayReservations.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-muted-foreground mb-4">No reservations</p>
                <Button variant="outline" onClick={onCreateReservation}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Reservation
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {todayReservations.map((res) => (
                  <div
                    key={res.id}
                    className="p-3 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">
                        {res.customer?.name || "Guest"}
                      </span>
                      <Badge className={getStatusBadgeClass(res.status)}>
                        {res.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {res.reservation_time.slice(0, 5)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {res.guests} guests
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
