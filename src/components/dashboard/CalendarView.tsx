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
import { ChevronLeft, ChevronRight, Plus, Users, Clock, CalendarDays, LayoutGrid, Phone, Trash2, Edit2, Save, X } from "lucide-react";
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ReservationDetailDialog } from "./ReservationDetailDialog";
import { EditReservationDialog } from "./EditReservationDialog";

interface Reservation {
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

interface CalendarViewProps {
  onCreateReservation: () => void;
  resetToToday?: number;
  refreshTrigger?: number;
}

type ViewMode = "week" | "month";

export const CalendarView = ({ onCreateReservation, resetToToday, refreshTrigger }: CalendarViewProps) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
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

  // Reset to today when logo is clicked
  useEffect(() => {
    if (resetToToday && resetToToday > 0) {
      const today = new Date();
      setSelectedDate(today);
      setCurrentMonth(today);
      setWeekStart(startOfWeek(today, { weekStartsOn: 1 }));
    }
  }, [resetToToday]);

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
        guests,
        status,
        notes,
        special_requests,
        source,
        created_at,
        customer:customers(name, phone, email)
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
    <div className="flex gap-4 md:gap-8 min-w-[900px]">
      {/* Calendar View */}
      <div className="flex-[2] min-w-0">
        <Card className="card-elevated border-0 shadow-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-6 pt-6 px-6 bg-gradient-to-r from-card via-card to-secondary/40 border-b border-border/30">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                <CalendarDays className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="font-display text-2xl font-bold tracking-tight">
                  {viewMode === "month" 
                    ? format(currentMonth, "MMMM yyyy")
                    : format(weekStart, "MMMM yyyy")
                  }
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {reservations.length} reservations this {viewMode}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* View Toggle */}
              <div className="flex items-center bg-secondary/60 rounded-xl p-1.5 shadow-inner">
                <Button
                  variant={viewMode === "week" ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-9 px-4 rounded-lg transition-all duration-300",
                    viewMode === "week" && "shadow-md"
                  )}
                  onClick={() => setViewMode("week")}
                >
                  <CalendarDays className="h-4 w-4 mr-2" />
                  Week
                </Button>
                <Button
                  variant={viewMode === "month" ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-9 px-4 rounded-lg transition-all duration-300",
                    viewMode === "month" && "shadow-md"
                  )}
                  onClick={() => setViewMode("month")}
                >
                  <LayoutGrid className="h-4 w-4 mr-2" />
                  Month
                </Button>
              </div>

              <div className="flex items-center bg-secondary/40 rounded-xl p-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-lg h-9 w-9 hover:bg-secondary"
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
                  className="rounded-lg px-4 h-9 hover:bg-secondary font-medium"
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
                  variant="ghost"
                  size="icon"
                  className="rounded-lg h-9 w-9 hover:bg-secondary"
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
                <div className="grid grid-cols-7 gap-2 mb-3">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                    <div key={day} className="text-center text-xs font-semibold text-muted-foreground py-2 uppercase tracking-wide">
                      {day}
                    </div>
                  ))}
                </div>
                
                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-2">
                  {monthDays.map((day, index) => {
                    if (!day) {
                      return <div key={`empty-${index}`} className="min-h-[90px]" />;
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
                          "calendar-cell group",
                          isSelected && "calendar-cell-selected",
                          isToday && !isSelected && "calendar-cell-today",
                          !isCurrentMonth && "opacity-40"
                        )}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span
                            className={cn(
                              "text-sm font-semibold",
                              isToday && "text-accent",
                              isSelected && "text-primary"
                            )}
                          >
                            {format(day, "d")}
                          </span>
                          {dayReservations.length > 0 && (
                            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-semibold bg-primary/10 text-primary">
                              {dayReservations.length}
                            </Badge>
                          )}
                        </div>
                        {dayReservations.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium">
                              <Users className="h-2.5 w-2.5" />
                              {totalGuests} guests
                            </div>
                            {dayReservations.slice(0, 2).map((res) => (
                              <div
                                key={res.id}
                                className="reservation-chip"
                              >
                                {res.reservation_time.slice(0, 5)} · {res.guests}p
                              </div>
                            ))}
                            {dayReservations.length > 2 && (
                              <div className="text-[10px] text-muted-foreground font-medium">
                                +{dayReservations.length - 2} more
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
      <div className="flex-1 min-w-[280px]">
        <Card className="card-elevated sticky top-24 border-0 shadow-2xl flex flex-col max-h-[calc(100vh-7rem)]">
          <CardHeader className="pb-4 pt-6 px-6 bg-gradient-to-br from-primary/10 via-card to-accent/10 border-b border-border/30">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
                    <span className="text-primary-foreground font-bold text-lg">
                      {format(selectedDate, "d")}
                    </span>
                  </div>
                  <div>
                    <CardTitle className="font-display text-xl font-bold tracking-tight">
                      {format(selectedDate, "EEEE")}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {format(selectedDate, "MMMM yyyy")}
                    </p>
                  </div>
                </div>
                {todayReservations.length > 0 && (
                  <div className="flex items-center gap-2 mt-3">
                    <div className="stat-card flex items-center gap-2 py-2 px-3">
                      <Users className="h-4 w-4 text-primary" />
                      <span className="text-sm font-bold text-foreground">
                        {todayReservations.reduce((sum, r) => sum + r.guests, 0)}
                      </span>
                      <span className="text-xs text-muted-foreground">guests</span>
                    </div>
                    <div className="stat-card flex items-center gap-2 py-2 px-3">
                      <Clock className="h-4 w-4 text-accent" />
                      <span className="text-sm font-bold text-foreground">
                        {todayReservations.length}
                      </span>
                      <span className="text-xs text-muted-foreground">bookings</span>
                    </div>
                  </div>
                )}
              </div>
              <Button 
                size="sm" 
                onClick={onCreateReservation} 
                className="gap-2 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-r from-accent to-accent/90 text-accent-foreground hover:from-accent/90 hover:to-accent"
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-5 pb-6 px-5 min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="py-12 text-center">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4 animate-pulse">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                <p className="text-muted-foreground">Loading reservations...</p>
              </div>
            ) : todayReservations.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-muted/50 to-muted/30 flex items-center justify-center mx-auto mb-5 shadow-inner">
                  <CalendarDays className="h-10 w-10 text-muted-foreground/60" />
                </div>
                <p className="text-muted-foreground mb-5 font-medium">No reservations yet</p>
                <Button 
                  variant="outline" 
                  onClick={onCreateReservation} 
                  className="gap-2 px-6 shadow-md hover:shadow-lg transition-all duration-300 border-2"
                >
                  <Plus className="h-4 w-4" />
                  Create First Reservation
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {todayReservations.map((res) => (
                  <div
                    key={res.id}
                    className="day-panel-card group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div 
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => {
                          setSelectedReservation(res);
                          setDetailDialogOpen(true);
                        }}
                      >
                        <span className="font-semibold block text-foreground group-hover:text-primary transition-colors">
                          {res.customer?.name || "Guest"}
                        </span>
                        {res.customer?.phone && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Phone className="h-3 w-3" />
                            {res.customer.phone}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={cn(getStatusBadgeClass(res.status), "text-xs font-medium")}>
                          {res.status}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            setReservationToEdit(res);
                            setEditDialogOpen(true);
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            setReservationToDelete(res);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div 
                      className="flex items-center gap-4 text-sm text-muted-foreground cursor-pointer"
                      onClick={() => {
                        setSelectedReservation(res);
                        setDetailDialogOpen(true);
                      }}
                    >
                      <span className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded">
                        <Clock className="h-3 w-3" />
                        {res.reservation_time.slice(0, 5)}
                      </span>
                      <span className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded">
                        <Users className="h-3 w-3" />
                        {res.guests} guests
                      </span>
                    </div>

                    {/* Staff Note Section - Inline Editable */}
                    {editingNoteId === res.id ? (
                      <div className="mt-3 space-y-2">
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
                        className="mt-3 text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 p-2.5 rounded-lg cursor-pointer group/note relative"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditingNote(res);
                        }}
                      >
                        <span className="font-medium text-amber-700 dark:text-amber-400">Staff Note:</span> {res.notes}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 absolute top-1 right-1 opacity-0 group-hover/note:opacity-100 transition-opacity text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditingNote(res);
                          }}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 h-7 px-2 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditingNote(res);
                        }}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Staff Note
                      </Button>
                    )}

                    {res.special_requests && (
                      <div 
                        className="mt-3 text-xs text-muted-foreground bg-accent/10 border border-accent/20 p-2.5 rounded-lg cursor-pointer"
                        onClick={() => {
                          setSelectedReservation(res);
                          setDetailDialogOpen(true);
                        }}
                      >
                        <span className="font-medium text-accent">Request:</span> {res.special_requests}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
