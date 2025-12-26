import { useState, useEffect } from "react";
import { 
  format, 
  startOfWeek, 
  startOfMonth, 
  endOfMonth,
  addDays, 
  addMonths,
  isSameDay, 
  isSameMonth,
  parseISO,
  getDay 
} from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus, Users, Clock, CalendarDays, LayoutGrid } from "lucide-react";
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

type ViewMode = "week" | "month";

export const CalendarView = ({ onCreateReservation }: CalendarViewProps) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));

  useEffect(() => {
    fetchReservations();
  }, [viewMode, weekStart, currentMonth]);

  const fetchReservations = async () => {
    setLoading(true);
    
    let startDate: Date;
    let endDate: Date;
    
    if (viewMode === "week") {
      startDate = weekStart;
      endDate = addDays(weekStart, 6);
    } else {
      startDate = startOfMonth(currentMonth);
      endDate = endOfMonth(currentMonth);
    }
    
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
      .gte("reservation_date", format(startDate, "yyyy-MM-dd"))
      .lte("reservation_date", format(endDate, "yyyy-MM-dd"))
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

  const getTotalGuestsForDate = (date: Date) => {
    return getReservationsForDate(date).reduce((sum, r) => sum + r.guests, 0);
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

  // Generate month calendar days
  const getMonthDays = () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const startDay = getDay(start);
    const adjustedStartDay = startDay === 0 ? 6 : startDay - 1; // Adjust for Monday start
    
    const days: (Date | null)[] = [];
    
    // Add empty slots for days before the month starts
    for (let i = 0; i < adjustedStartDay; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    let current = start;
    while (current <= end) {
      days.push(current);
      current = addDays(current, 1);
    }
    
    return days;
  };

  const monthDays = getMonthDays();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Calendar View */}
      <div className="lg:col-span-2">
        <Card className="card-elevated">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="font-display text-lg">
              {viewMode === "month" 
                ? format(currentMonth, "MMMM yyyy")
                : format(weekStart, "MMMM yyyy")
              }
            </CardTitle>
            <div className="flex items-center gap-2">
              {/* View Toggle */}
              <div className="flex items-center border rounded-lg p-1 mr-2">
                <Button
                  variant={viewMode === "week" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setViewMode("week")}
                >
                  <CalendarDays className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "month" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setViewMode("month")}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </div>

              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  if (viewMode === "week") {
                    setWeekStart(addDays(weekStart, -7));
                  } else {
                    setCurrentMonth(addMonths(currentMonth, -1));
                  }
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const today = new Date();
                  if (viewMode === "week") {
                    setWeekStart(startOfWeek(today, { weekStartsOn: 1 }));
                  } else {
                    setCurrentMonth(today);
                  }
                  setSelectedDate(today);
                }}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  if (viewMode === "week") {
                    setWeekStart(addDays(weekStart, 7));
                  } else {
                    setCurrentMonth(addMonths(currentMonth, 1));
                  }
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {viewMode === "week" ? (
              /* Week View */
              <div className="grid grid-cols-7 gap-2">
                {weekDays.map((day) => {
                  const dayReservations = getReservationsForDate(day);
                  const totalGuests = getTotalGuestsForDate(day);
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
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                            <Users className="h-3 w-3" />
                            {totalGuests} guests
                          </div>
                          {dayReservations.slice(0, 2).map((res) => (
                            <div
                              key={res.id}
                              className="text-xs bg-primary/10 text-primary rounded px-1.5 py-0.5 truncate"
                            >
                              {res.reservation_time.slice(0, 5)} · {res.guests}p
                            </div>
                          ))}
                          {dayReservations.length > 2 && (
                            <div className="text-xs text-muted-foreground">
                              +{dayReservations.length - 2} more
                            </div>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              /* Month View */
              <div>
                {/* Weekday headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                    <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                      {day}
                    </div>
                  ))}
                </div>
                
                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
                  {monthDays.map((day, index) => {
                    if (!day) {
                      return <div key={`empty-${index}`} className="min-h-[80px]" />;
                    }

                    const dayReservations = getReservationsForDate(day);
                    const totalGuests = getTotalGuestsForDate(day);
                    const isSelected = isSameDay(day, selectedDate);
                    const isToday = isSameDay(day, new Date());
                    const isCurrentMonth = isSameMonth(day, currentMonth);

                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => setSelectedDate(day)}
                        className={cn(
                          "p-2 rounded-lg text-left transition-all min-h-[80px] border",
                          isSelected
                            ? "bg-primary/10 border-primary"
                            : "bg-card border-border hover:border-primary/50",
                          isToday && !isSelected && "ring-2 ring-accent ring-offset-1",
                          !isCurrentMonth && "opacity-40"
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={cn(
                              "text-sm font-medium",
                              isToday && "text-accent"
                            )}
                          >
                            {format(day, "d")}
                          </span>
                          {dayReservations.length > 0 && (
                            <Badge variant="secondary" className="text-[10px] h-5 px-1">
                              {dayReservations.length}
                            </Badge>
                          )}
                        </div>
                        {dayReservations.length > 0 && (
                          <div className="space-y-0.5">
                            <div className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <Users className="h-2.5 w-2.5" />
                              {totalGuests}
                            </div>
                            {dayReservations.slice(0, 2).map((res) => (
                              <div
                                key={res.id}
                                className="text-[10px] bg-primary/10 text-primary rounded px-1 py-0.5 truncate"
                              >
                                {res.reservation_time.slice(0, 5)} · {res.guests}p
                              </div>
                            ))}
                            {dayReservations.length > 2 && (
                              <div className="text-[10px] text-muted-foreground">
                                +{dayReservations.length - 2}
                              </div>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
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
              {todayReservations.length > 0 && (
                <p className="text-sm text-primary mt-1 flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {todayReservations.reduce((sum, r) => sum + r.guests, 0)} total guests
                </p>
              )}
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
