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
import { ChevronLeft, ChevronRight, Plus, Users, Clock, CalendarDays, LayoutGrid, Phone, Trash2, Edit2, Save, X, ChevronDown, Search, BookOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ReservationDetailDialog } from "./ReservationDetailDialog";
import { EditReservationDialog } from "./EditReservationDialog";
import { InlineTableAssignment } from "./InlineTableAssignment";

interface Reservation {
  id: string;
  reservation_date: string;
  reservation_time: string;
  reservation_end_time: string | null;
  guests: number;
  status: string;
  dining_status: 'reserved' | 'seated' | 'completed' | 'cancelled' | 'no_show';
  notes: string | null;
  special_requests: string | null;
  source: string;
  created_at: string;
  assigned_table_id: string | null;
  assigned_table?: {
    id: string;
    table_number: string;
    capacity: number;
    zone: string;
  } | null;
  customer: {
    name: string;
    phone: string;
    email: string | null;
  } | null;
}

interface CalendarViewProps {
  onCreateReservation: () => void;
  refreshTrigger?: number;
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  calendarPopoverOpen: boolean;
  onCalendarPopoverChange: (open: boolean) => void;
  onStatsChange: (stats: { guests: number; bookings: number }) => void;
}

type ViewMode = "week" | "month";

export const CalendarView = ({ 
  onCreateReservation, 
  refreshTrigger, 
  selectedDate, 
  onDateChange,
  calendarPopoverOpen,
  onCalendarPopoverChange,
  onStatsChange
}: CalendarViewProps) => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reservationToDelete, setReservationToDelete] = useState<Reservation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [reservationToEdit, setReservationToEdit] = useState<Reservation | null>(null);
  
  // Staff note inline editing state
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  
  // Customer search state
  const [customerSearch, setCustomerSearch] = useState("");
  
  // Current time for "in progress" detection (updates every minute)
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Update current time every minute for live status
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Check if reservation time slot is currently active (LIVE)
  // A reservation is LIVE if:
  // 1. It's for today
  // 2. It's not completed/cancelled/no_show
  // 3. EITHER the dining_status is 'seated' (customer is currently dining) 
  //    OR the current time is within the reservation time slot
  const isTimeSlotActive = (reservation: Reservation): boolean => {
    const today = format(new Date(), "yyyy-MM-dd");
    if (reservation.reservation_date !== today) return false;
    
    // Skip if already completed/cancelled
    if (reservation.dining_status === "completed" ||
        reservation.dining_status === "cancelled" ||
        reservation.dining_status === "no_show" ||
        reservation.status === "cancelled") {
      return false;
    }
    
    // If customer is already seated (e.g., arrived early), show as LIVE
    if (reservation.dining_status === "seated") {
      return true;
    }
    
    const [startHours, startMinutes] = reservation.reservation_time.split(":").map(Number);
    const reservationStart = new Date();
    reservationStart.setHours(startHours, startMinutes, 0, 0);
    
    // Calculate end time (use explicit end_time or default 120 min)
    let reservationEnd: Date;
    if (reservation.reservation_end_time) {
      const [endHours, endMinutes] = reservation.reservation_end_time.split(":").map(Number);
      reservationEnd = new Date();
      reservationEnd.setHours(endHours, endMinutes, 0, 0);
    } else {
      reservationEnd = new Date(reservationStart.getTime() + 120 * 60 * 1000);
    }
    
    return currentTime >= reservationStart && currentTime < reservationEnd;
  };

  // Check if reservation is in the past (for graying out)
  const isReservationPast = (reservation: Reservation): boolean => {
    const today = format(new Date(), "yyyy-MM-dd");
    
    // Past date = always gray
    if (reservation.reservation_date < today) return true;
    
    // Future date = never gray
    if (reservation.reservation_date > today) return false;
    
    // Today: check if time slot has ended
    const [startHours, startMinutes] = reservation.reservation_time.split(":").map(Number);
    const reservationStart = new Date();
    reservationStart.setHours(startHours, startMinutes, 0, 0);
    
    // Calculate end time
    let reservationEnd: Date;
    if (reservation.reservation_end_time) {
      const [endHours, endMinutes] = reservation.reservation_end_time.split(":").map(Number);
      reservationEnd = new Date();
      reservationEnd.setHours(endHours, endMinutes, 0, 0);
    } else {
      reservationEnd = new Date(reservationStart.getTime() + 120 * 60 * 1000);
    }
    
    return currentTime >= reservationEnd;
  };

  const handleSaveNote = async (reservationId: string) => {
    setIsSavingNote(true);
    try {
      const { error } = await supabase
        .from("reservations")
        .update({ notes: noteText.trim() || null })
        .eq("id", reservationId);

      if (error) throw error;

      toast.success("Staff note saved");
      setEditingNoteId(null);
      setNoteText("");
      fetchReservations();
    } catch (error: any) {
      toast.error("Failed to save note: " + error.message);
    } finally {
      setIsSavingNote(false);
    }
  };

  const startEditingNote = (reservation: Reservation) => {
    setEditingNoteId(reservation.id);
    setNoteText(reservation.notes || "");
  };

  const cancelEditingNote = () => {
    setEditingNoteId(null);
    setNoteText("");
  };

  const handleDeleteReservation = async () => {
    if (!reservationToDelete) return;
    
    setIsDeleting(true);
    try {
      // First delete from reservation_tables if any
      await supabase
        .from("reservation_tables")
        .delete()
        .eq("reservation_id", reservationToDelete.id);

      // Then delete the reservation
      const { error } = await supabase
        .from("reservations")
        .delete()
        .eq("id", reservationToDelete.id);

      if (error) throw error;

      toast.success("Reservation deleted successfully");
      setDeleteDialogOpen(false);
      setReservationToDelete(null);
      fetchReservations();
    } catch (error: any) {
      toast.error("Failed to delete reservation: " + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Sync currentMonth with selectedDate when it changes externally
  useEffect(() => {
    setCurrentMonth(selectedDate);
    setWeekStart(startOfWeek(selectedDate, { weekStartsOn: 1 }));
  }, [selectedDate]);

  // Refresh when new reservation comes in
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      fetchReservations();
    }
  }, [refreshTrigger]);


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
        reservation_end_time,
        guests,
        status,
        dining_status,
        notes,
        special_requests,
        source,
        created_at,
        assigned_table_id,
        customer:customers(name, phone, email),
        assigned_table:tables(id, table_number, capacity, zone)
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

  // Report stats to parent
  useEffect(() => {
    const activeReservations = todayReservations.filter(
      r => r.status !== 'cancelled' && r.dining_status !== 'cancelled' && r.dining_status !== 'no_show'
    );
    const totalGuests = activeReservations.reduce((sum, r) => sum + r.guests, 0);
    const activeBookings = activeReservations.length;
    onStatsChange({ guests: totalGuests, bookings: activeBookings });
  }, [todayReservations, onStatsChange]);

  // Calendar content for popover/dropdown
  const renderCalendarContent = () => (
    <div className="w-full">
      <div className="flex items-center justify-between gap-2 mb-3">
        {/* View Toggle */}
        <div className="flex items-center bg-secondary/60 rounded-lg p-1 shadow-inner">
          <Button
            variant={viewMode === "week" ? "default" : "ghost"}
            size="sm"
            className={cn(
              "h-7 px-2.5 rounded-md transition-all duration-300 text-xs",
              viewMode === "week" && "shadow-md"
            )}
            onClick={() => setViewMode("week")}
          >
            <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
            Week
          </Button>
          <Button
            variant={viewMode === "month" ? "default" : "ghost"}
            size="sm"
            className={cn(
              "h-7 px-2.5 rounded-md transition-all duration-300 text-xs",
              viewMode === "month" && "shadow-md"
            )}
            onClick={() => setViewMode("month")}
          >
            <LayoutGrid className="h-3.5 w-3.5 mr-1.5" />
            Month
          </Button>
        </div>

        <div className="flex items-center bg-secondary/40 rounded-lg p-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-md h-7 w-7 hover:bg-secondary"
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
            variant="ghost"
            size="sm"
            className="rounded-md px-2.5 h-7 hover:bg-secondary font-medium text-xs"
            onClick={() => {
              const today = new Date();
              if (viewMode === "week") {
                setWeekStart(startOfWeek(today, { weekStartsOn: 1 }));
              } else {
                setCurrentMonth(today);
              }
              onDateChange(today);
            }}
          >
            Today
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-md h-7 w-7 hover:bg-secondary"
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
      </div>

      {viewMode === "week" ? (
        /* Week View */
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((day) => {
            const dayReservations = getReservationsForDate(day);
            const totalGuests = getTotalGuestsForDate(day);
            const isSelected = isSameDay(day, selectedDate);
            const isToday = isSameDay(day, new Date());

            return (
              <button
                key={day.toISOString()}
                onClick={() => {
                  onDateChange(day);
                  onCalendarPopoverChange(false);
                }}
                className={cn(
                  "p-1.5 rounded-lg text-center transition-all min-h-[70px] border",
                  isSelected
                    ? "bg-primary/10 border-primary"
                    : "bg-card border-border hover:border-primary/50",
                  isToday && !isSelected && "ring-2 ring-accent ring-offset-1"
                )}
              >
                <div className="text-[10px] text-muted-foreground">
                  {format(day, "EEE")}
                </div>
                <div
                  className={cn(
                    "text-sm font-semibold",
                    isToday && "text-accent",
                    isSelected && "text-primary"
                  )}
                >
                  {format(day, "d")}
                </div>
                {dayReservations.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    <div className="text-[9px] text-muted-foreground flex items-center justify-center gap-0.5">
                      <Users className="h-2.5 w-2.5" />
                      {totalGuests}
                    </div>
                    <Badge variant="secondary" className="text-[8px] h-4 px-1 font-semibold">
                      {dayReservations.length}
                    </Badge>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        /* Month View */
        <div>
          {/* Month title */}
          <div className="text-center font-semibold text-sm mb-2">
            {format(currentMonth, "MMMM yyyy")}
          </div>
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => (
              <div key={i} className="text-center text-[10px] font-semibold text-muted-foreground py-1 uppercase">
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {monthDays.map((day, index) => {
              if (!day) {
                return <div key={`empty-${index}`} className="min-h-[40px]" />;
              }

              const dayReservations = getReservationsForDate(day);
              const totalGuests = getTotalGuestsForDate(day);
              const isSelected = isSameDay(day, selectedDate);
              const isToday = isSameDay(day, new Date());
              const isCurrentMonth = isSameMonth(day, currentMonth);

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => {
                    onDateChange(day);
                    onCalendarPopoverChange(false);
                  }}
                  className={cn(
                    "p-1 rounded-lg text-center transition-all duration-300 min-h-[40px] border bg-gradient-to-br from-card to-card/80 border-border/40 hover:border-primary/50 cursor-pointer relative",
                    isSelected && "bg-gradient-to-br from-primary/10 to-primary/20 border-primary shadow-md",
                    isToday && !isSelected && "ring-2 ring-accent ring-offset-1 ring-offset-background",
                    !isCurrentMonth && "opacity-40"
                  )}
                >
                  <div className="flex items-center justify-between px-0.5">
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        isToday && "text-accent",
                        isSelected && "text-primary"
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    {dayReservations.length > 0 && (
                      <Badge variant="secondary" className="text-[8px] h-4 min-w-4 px-1 font-bold bg-primary/10 text-primary">
                        {dayReservations.length}
                      </Badge>
                    )}
                  </div>
                  {dayReservations.length > 0 && (
                    <div className="text-[8px] text-muted-foreground flex items-center justify-center gap-0.5 mt-0.5">
                      <Users className="h-2 w-2" />
                      {totalGuests}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="w-full">
      {/* Calendar Popover Content - render when calendar tab is active */}
      {calendarPopoverOpen && (
        <div className="mb-4 p-4 bg-card border border-border rounded-xl shadow-lg">
          {renderCalendarContent()}
        </div>
      )}

      {/* Full Width Reservation Panel */}
      <Card className="card-elevated border-0 shadow-2xl flex flex-col min-h-[70vh] lg:min-h-[calc(100vh-100px)] overflow-hidden">

        <CardContent className="pt-5 pb-6 px-4 sm:px-6 min-h-0 flex-1 overflow-y-auto">
          {/* Customer Search */}
          {todayReservations.length > 0 && (
            <div className="relative mb-4 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search customer..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="pl-10 h-10"
              />
              {customerSearch && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={() => setCustomerSearch("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
            
            {loading ? (
              <div className="py-12 text-center">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4 animate-pulse">
                  <Clock className="h-7 w-7 text-primary" />
                </div>
                <p className="text-base text-muted-foreground">Loading reservations...</p>
              </div>
            ) : todayReservations.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-muted/50 to-muted/30 flex items-center justify-center mx-auto mb-6 shadow-inner">
                  <CalendarDays className="h-12 w-12 text-muted-foreground/60" />
                </div>
                <p className="text-lg text-muted-foreground mb-6 font-medium">No reservations yet</p>
                <Button 
                  variant="outline" 
                  onClick={onCreateReservation} 
                  className="gap-2 px-8 shadow-md hover:shadow-lg transition-all duration-300 border-2"
                >
                  <Plus className="h-4 w-4" />
                  Create First Reservation
                </Button>
              </div>
            ) : (() => {
              const filteredReservations = customerSearch.trim()
                ? todayReservations.filter(r => 
                    r.customer?.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
                    r.customer?.phone?.toLowerCase().includes(customerSearch.toLowerCase())
                  )
                : todayReservations;
              
              if (filteredReservations.length === 0) {
                return (
                  <div className="py-8 text-center">
                    <p className="text-base text-muted-foreground">No matching customers found</p>
                  </div>
                );
              }
              
              return (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredReservations.map((res) => {
                  const slotActive = isTimeSlotActive(res);
                  const slotPast = isReservationPast(res);
                  return (
                  <div
                    key={res.id}
                    className={cn(
                      "p-2 rounded-lg border transition-all duration-300 cursor-pointer hover:shadow-md relative overflow-hidden group",
                      slotActive 
                        ? "reservation-in-progress" 
                        : slotPast
                          ? "reservation-past"
                          : "border-border/50 bg-gradient-to-br from-card to-secondary/30 hover:border-primary/50"
                    )}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div 
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => {
                          setSelectedReservation(res);
                          setDetailDialogOpen(true);
                        }}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-base text-foreground group-hover:text-primary transition-colors truncate">
                            {res.customer?.name || "Guest"}
                          </span>
                          {slotActive && (
                            <Badge className="badge-in-progress text-[10px] px-1.5 py-0.5">
                              LIVE
                            </Badge>
                          )}
                          <Badge className={cn(getStatusBadgeClass(res.status), "text-xs font-medium px-2")}>
                            {res.status}
                          </Badge>
                        </div>
                        {res.customer?.phone && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Phone className="h-3 w-3" />
                            {res.customer.phone}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setReservationToEdit(res);
                            setEditDialogOpen(true);
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div 
                      className="flex items-center gap-3 text-sm text-muted-foreground cursor-pointer"
                      onClick={() => {
                        setSelectedReservation(res);
                        setDetailDialogOpen(true);
                      }}
                    >
                      <span className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded text-xs">
                        <Clock className="h-3 w-3" />
                        {res.reservation_time.slice(0, 5)}
                      </span>
                      <span className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded text-xs">
                        <Users className="h-3 w-3" />
                        {res.guests} guests
                      </span>
                    </div>

                    {/* Inline Table Assignment */}
                    <InlineTableAssignment
                      reservationId={res.id}
                      reservationDate={res.reservation_date}
                      reservationTime={res.reservation_time}
                      reservationEndTime={res.reservation_end_time}
                      currentTableId={res.assigned_table_id}
                      currentTableNumber={res.assigned_table?.table_number}
                      guests={res.guests}
                      diningStatus={res.dining_status}
                      onTableAssigned={fetchReservations}
                      onDiningStatusChange={fetchReservations}
                    />

                    {/* Staff Note Section - Inline Editable */}
                    {editingNoteId === res.id ? (
                      <div className="mt-1 space-y-1.5">
                        <Textarea
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          placeholder="Add staff note..."
                          className="text-xs min-h-[60px] resize-none"
                          autoFocus
                        />
                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={cancelEditingNote}
                            disabled={isSavingNote}
                          >
                            <X className="h-3 w-3 mr-1" />
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => handleSaveNote(res.id)}
                            disabled={isSavingNote}
                          >
                            <Save className="h-3 w-3 mr-1" />
                            {isSavingNote ? "Saving..." : "Save"}
                          </Button>
                        </div>
                      </div>
                    ) : res.notes ? (
                      <div 
                        className="mt-1 text-xs staff-note-box cursor-pointer group/note relative py-1 px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditingNote(res);
                        }}
                      >
                        <span className="staff-note-label">Staff Note:</span>{" "}
                        <span className="staff-note-text">{res.notes}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 absolute top-1 right-1 opacity-0 group-hover/note:opacity-100 transition-opacity text-accent-foreground hover:bg-accent/20"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditingNote(res);
                          }}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : null}

                    {res.special_requests && (
                      <div 
                        className="mt-1 text-xs request-box cursor-pointer py-1 px-2"
                        onClick={() => {
                          setSelectedReservation(res);
                          setDetailDialogOpen(true);
                        }}
                      >
                        <span className="request-label">Request:</span>{" "}
                        <span className="request-text">{res.special_requests}</span>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
              );
            })()}
          </CardContent>
        </Card>

      {/* Reservation Detail Dialog */}
      <ReservationDetailDialog
        reservation={selectedReservation}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        onStatusChange={fetchReservations}
      />

      {/* Edit Reservation Dialog */}
      <EditReservationDialog
        reservation={reservationToEdit}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={fetchReservations}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Reservation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the reservation for{" "}
              <strong>{reservationToDelete?.customer?.name || "Guest"}</strong> on{" "}
              {reservationToDelete && format(parseISO(reservationToDelete.reservation_date), "MMMM d, yyyy")} at{" "}
              {reservationToDelete?.reservation_time.slice(0, 5)}?
              <br /><br />
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteReservation}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
