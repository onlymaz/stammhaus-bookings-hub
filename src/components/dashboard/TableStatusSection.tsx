import { useEffect, useMemo, useState, useCallback } from "react";
import { format, isBefore, isSameDay, startOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Table2, CheckCircle, Clock, Home, Building, TreePine, Layers, UserPlus, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TableZone } from "@/types/table";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TableWithZone {
  id: string;
  table_number: string;
  zone: TableZone;
  capacity: number;
}

interface ReservationSlot {
  reservationTime: string;
  reservationEndTime: string;
  customerName: string;
}

interface TableReservationInfo {
  tableId: string;
  tableNumber: string;
  zone: TableZone;
  reservations: ReservationSlot[];
}

interface TableStatusSectionProps {
  selectedDate: Date;
  refreshTrigger?: number;
  onRefresh?: () => void;
}

// Zone order for sorting: T, R, G, M
const zoneOrder: Record<string, number> = { inside: 0, room: 1, garden: 2, mezz: 3 };

// Zone labels
const zoneLabels: Record<TableZone, { label: string; icon: React.ElementType }> = {
  inside: { label: 'Inside (T)', icon: Home },
  room: { label: 'Room (R)', icon: Building },
  garden: { label: 'Garden (G)', icon: TreePine },
  mezz: { label: 'Mezz (M)', icon: Layers },
};

// Calculate end time (default 2 hours)
const calculateEndTime = (startTime: string): string => {
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + 120;
  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMins = totalMinutes % 60;
  return `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}:00`;
};

export const TableStatusSection = ({ selectedDate, refreshTrigger, onRefresh }: TableStatusSectionProps) => {
  const [allTables, setAllTables] = useState<TableWithZone[]>([]);
  const [tableReservations, setTableReservations] = useState<Map<string, TableReservationInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'free' | 'reserved'>('free');
  const [nowTick, setNowTick] = useState(0);
  const [seatLoading, setSeatLoading] = useState<string | null>(null); // Track which table is being seated

  // Display without leading zeros: T01 -> T1, M01 -> M1 (keeps R37/G47 as-is)
  const getTableDisplayName = (table: { table_number: string }) => {
    const raw = table.table_number;
    const m = raw.match(/^([A-Za-z]+)0*(\d+)$/);
    if (!m) return raw;
    const prefix = m[1];
    const n = parseInt(m[2], 10);
    return `${prefix}${Number.isFinite(n) ? n : m[2]}`;
  };

  // Helper for numeric sorting
  const getTableNumeric = (tableNumber: string) => {
    const match = tableNumber.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  };

  const timeStrToMinutes = (timeStr: string) => {
    const [hh, mm] = timeStr.split(":");
    const h = parseInt(hh || "0", 10);
    const m = parseInt(mm || "0", 10);
    return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
  };

  const minutesToTimeStr = (minutes: number) => {
    const mins = ((minutes % 1440) + 1440) % 1440;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
  };

  const computeEndTime = (startTime: string, endTime: string | null) => {
    if (endTime) return endTime;
    return minutesToTimeStr(timeStrToMinutes(startTime) + 120);
  };

  // Quick-seat a walk-in customer on a table (no dialog)
  const quickSeatWalkIn = async (table: TableWithZone) => {
    setSeatLoading(table.id);
    
    try {
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = Math.floor(now.getMinutes() / 15) * 15;
      const startTime = `${currentHours.toString().padStart(2, '0')}:${currentMinutes.toString().padStart(2, '0')}:00`;
      const endTime = calculateEndTime(startTime);
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      
      // Create a generic walk-in customer
      const { data: newCustomer, error: customerError } = await supabase
        .from("customers")
        .insert({
          name: "Walk-in",
          phone: `walk-in-${Date.now()}`
        })
        .select("id")
        .single();

      if (customerError) throw customerError;

      // Create reservation with dining_status 'seated'
      const { data: reservation, error: resError } = await supabase
        .from("reservations")
        .insert({
          customer_id: newCustomer.id,
          reservation_date: dateStr,
          reservation_time: startTime,
          reservation_end_time: endTime,
          guests: 2,
          source: "walk-in",
          status: "confirmed",
          dining_status: "seated",
          assigned_table_id: table.id,
          notes: "Walk-in customer"
        })
        .select("id")
        .single();

      if (resError) throw resError;

      // Add to reservation_tables junction
      await supabase
        .from("reservation_tables")
        .insert({
          reservation_id: reservation.id,
          table_id: table.id
        });

      const displayName = getTableDisplayName(table);
      toast.success(`Walk-in seated at ${displayName}`);
      fetchTableStatus();
      onRefresh?.();
    } catch (error: any) {
      console.error("Error seating walk-in:", error);
      toast.error(error.message || "Failed to seat customer");
    } finally {
      setSeatLoading(null);
    }
  };

  const fetchTableStatus = async () => {
    setLoading(true);
    const dateStr = format(selectedDate, "yyyy-MM-dd");

    try {
      // Fetch all active tables
      const { data: tables, error: tablesError } = await supabase
        .from('tables')
        .select('id, table_number, zone, capacity')
        .eq('is_active', true)
        .order('zone')
        .order('table_number');

      if (tablesError) throw tablesError;

      // Fetch all reservations for the day (excluding cancelled/no_show)
      const { data: reservations, error: resError } = await supabase
        .from('reservations')
        .select(`
          id,
          reservation_time,
          reservation_end_time,
          assigned_table_id,
          customer:customers(name)
        `)
        .eq('reservation_date', dateStr)
        .not('status', 'in', '("cancelled","no_show")');

      if (resError) throw resError;

      // Fetch multi-table assignments from reservation_tables junction table
      const reservationIds = (reservations || []).map(r => r.id);
      let multiTableAssignments: { reservation_id: string; table_id: string }[] = [];
      
      if (reservationIds.length > 0) {
        const { data: assignments, error: assignError } = await supabase
          .from('reservation_tables')
          .select('reservation_id, table_id')
          .in('reservation_id', reservationIds);
        
        if (assignError) throw assignError;
        multiTableAssignments = assignments || [];
      }

      // Sort tables by zone order, then numerically
      const sortedTables = (tables || []).sort((a, b) => {
        const zoneA = zoneOrder[a.zone] ?? 99;
        const zoneB = zoneOrder[b.zone] ?? 99;
        if (zoneA !== zoneB) return zoneA - zoneB;
        return getTableNumeric(a.table_number) - getTableNumeric(b.table_number);
      }) as TableWithZone[];

      setAllTables(sortedTables);

      // Build a map of table -> all its reservations for the day
      const tableResMap = new Map<string, TableReservationInfo>();
      
      // Initialize all tables in the map
      sortedTables.forEach(table => {
        tableResMap.set(table.id, {
          tableId: table.id,
          tableNumber: table.table_number,
          zone: table.zone,
          reservations: []
        });
      });

      // Add reservations to their tables
      (reservations || []).forEach(res => {
        const customerName = res.customer?.name || 'Unknown';
        const reservationTime = res.reservation_time;
        const reservationEndTime = computeEndTime(res.reservation_time, res.reservation_end_time);

        const slot: ReservationSlot = {
          reservationTime,
          reservationEndTime,
          customerName
        };

        // Get all table IDs for this reservation (from junction table)
        const assignedTableIds = multiTableAssignments
          .filter(a => a.reservation_id === res.id)
          .map(a => a.table_id);

        // Also include the legacy assigned_table_id if not already in the list
        if (res.assigned_table_id && !assignedTableIds.includes(res.assigned_table_id)) {
          assignedTableIds.push(res.assigned_table_id);
        }

        // Add this reservation slot to each assigned table
        assignedTableIds.forEach(tableId => {
          const tableInfo = tableResMap.get(tableId);
          if (tableInfo) {
            tableInfo.reservations.push(slot);
          }
        });
      });

      // Sort reservations by time for each table
      tableResMap.forEach(tableInfo => {
        tableInfo.reservations.sort((a, b) => 
          timeStrToMinutes(a.reservationTime) - timeStrToMinutes(b.reservationTime)
        );
      });

      setTableReservations(tableResMap);
    } catch (error) {
      console.error('Error fetching table status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTableStatus();
  }, [selectedDate, refreshTrigger]);

  // Auto-refresh the derived Free/Reserved state while viewing "today"
  useEffect(() => {
    if (!isSameDay(selectedDate, new Date())) return;
    const id = window.setInterval(() => setNowTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, [selectedDate]);

  // Calculate current availability based on time
  const { freeTables, reservedTables } = useMemo(() => {
    void nowTick;

    const today = new Date();
    const selectedDay = startOfDay(selectedDate);
    const todayDay = startOfDay(today);
    const nowMinutes = today.getHours() * 60 + today.getMinutes();

    const free: TableWithZone[] = [];
    const reserved: Array<{ table: TableWithZone; slots: ReservationSlot[] }> = [];

    allTables.forEach(table => {
      const tableInfo = tableReservations.get(table.id);
      
      if (!tableInfo || tableInfo.reservations.length === 0) {
        // No reservations - table is free
        free.push(table);
        return;
      }

      // Filter reservations based on date context
      let activeReservations = tableInfo.reservations;
      
      if (isBefore(selectedDay, todayDay)) {
        // Past day - all reservations ended, table is free
        free.push(table);
        return;
      } else if (isSameDay(selectedDate, today)) {
        // Today - only show reservations that haven't ended yet
        activeReservations = tableInfo.reservations.filter(
          slot => timeStrToMinutes(slot.reservationEndTime) > nowMinutes
        );
        
        if (activeReservations.length === 0) {
          // All reservations for today have ended
          free.push(table);
          return;
        }
      }

      // Table has active reservations - add to reserved list
      reserved.push({ table, slots: activeReservations });

      // Check if table is currently free (between reservations or before first booking)
      if (isSameDay(selectedDate, today)) {
        // Check if we're currently in a gap between reservations
        const isCurrentlyOccupied = activeReservations.some(slot => {
          const startMin = timeStrToMinutes(slot.reservationTime);
          const endMin = timeStrToMinutes(slot.reservationEndTime);
          return nowMinutes >= startMin && nowMinutes < endMin;
        });

        if (!isCurrentlyOccupied) {
          // Table is not currently occupied - also show in free list
          free.push(table);
        }
      } else {
        // Future day - table has reservations but could have free slots too
        // Show in free if there's potential for more bookings (always true for future days)
        free.push(table);
      }
    });

    return { freeTables: free, reservedTables: reserved };
  }, [allTables, tableReservations, selectedDate, nowTick]);

  // Group by zone for display
  const freeByZone = {
    inside: freeTables.filter(t => t.zone === 'inside'),
    room: freeTables.filter(t => t.zone === 'room'),
    garden: freeTables.filter(t => t.zone === 'garden'),
    mezz: freeTables.filter(t => t.zone === 'mezz'),
  };

  const reservedByZone = {
    inside: reservedTables.filter(rt => rt.table.zone === 'inside'),
    room: reservedTables.filter(rt => rt.table.zone === 'room'),
    garden: reservedTables.filter(rt => rt.table.zone === 'garden'),
    mezz: reservedTables.filter(rt => rt.table.zone === 'mezz'),
  };

  const allZones: TableZone[] = ['inside', 'room', 'garden', 'mezz'];

  if (loading) {
    return (
      <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-border/40">
        <div className="flex items-center gap-1.5">
          <Table2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground font-medium">Table Status:</span>
        </div>
        <div className="text-[10px] text-muted-foreground animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Table2 className="h-5 w-5 text-primary" />
        <span className="text-base font-semibold">Table Status</span>
        <span className="text-sm text-muted-foreground">({allTables.length} tables)</span>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'free' | 'reserved')}>
        <TabsList className="w-full h-10 p-1">
          <TabsTrigger value="free" className="flex-1 h-8 text-sm gap-2">
            <CheckCircle className="h-4 w-4" />
            Free ({freeTables.length})
          </TabsTrigger>
          <TabsTrigger value="reserved" className="flex-1 h-8 text-sm gap-2">
            <Clock className="h-4 w-4" />
            Reserved ({reservedTables.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="free" className="mt-4">
          <ScrollArea className="h-auto max-h-[60vh] rounded-lg border bg-card p-4">
            {freeTables.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                No free tables for this time
              </div>
            ) : (
              <div className="space-y-4">
                {allZones.map(zone => {
                  const zoneTables = freeByZone[zone];
                  if (zoneTables.length === 0) return null;
                  const ZoneIcon = zoneLabels[zone].icon;
                  return (
                    <div key={zone}>
                      <div className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                        <ZoneIcon className="h-4 w-4" /> {zoneLabels[zone].label} ({zoneTables.length})
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {zoneTables.map(table => {
                          // Check if this table has any reservations today
                          const tableInfo = tableReservations.get(table.id);
                          const hasReservations = tableInfo && tableInfo.reservations.length > 0;
                          const isToday = isSameDay(selectedDate, new Date());
                          const isSeating = seatLoading === table.id;
                          
                          return (
                            <Tooltip key={table.id}>
                              <TooltipTrigger asChild>
                                <Badge
                                  variant="outline"
                                  className={`text-sm px-3 py-1 cursor-pointer transition-all hover:scale-105 ${
                                    isSeating
                                      ? 'bg-primary/20 text-primary border-primary/50'
                                      : hasReservations 
                                        ? 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-700 hover:bg-amber-100'
                                        : 'bg-success/10 text-success border-success/30 hover:bg-success/20'
                                  }`}
                                  onClick={() => {
                                    if (isToday && !isSeating) {
                                      quickSeatWalkIn(table);
                                    }
                                  }}
                                >
                                  {getTableDisplayName(table)}
                                  {isSeating ? (
                                    <Loader2 className="h-3 w-3 ml-1 animate-spin" />
                                  ) : isToday ? (
                                    <UserPlus className="h-3 w-3 ml-1 opacity-60" />
                                  ) : null}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                {isToday ? (
                                  <p>Click to seat walk-in</p>
                                ) : (
                                  <p>{hasReservations ? 'Has reservations - available between bookings' : 'No reservations'}</p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="reserved" className="mt-4">
          <ScrollArea className="h-[400px] rounded-lg border bg-card p-4">
            {reservedTables.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                No reserved tables for this day
              </div>
            ) : (
              <div className="space-y-4">
                {allZones.map(zone => {
                  const zoneReserved = reservedByZone[zone];
                  if (zoneReserved.length === 0) return null;
                  const ZoneIcon = zoneLabels[zone].icon;
                  return (
                    <div key={zone}>
                      <div className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2 mt-4 first:mt-0">
                        <ZoneIcon className="h-4 w-4" /> {zoneLabels[zone].label} ({zoneReserved.length})
                      </div>
                      {zoneReserved.map((rt) => (
                        <div key={rt.table.id} className="mb-3">
                          {rt.slots.map((slot, idx) => (
                            <div
                              key={`${rt.table.id}-${idx}`}
                              className="flex items-center justify-between gap-3 px-4 py-2 rounded-lg bg-muted/50 text-sm mb-1"
                            >
                              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 px-3 py-1">
                                {getTableDisplayName({ table_number: rt.table.table_number })}
                              </Badge>
                              <span className="text-muted-foreground truncate flex-1">{slot.customerName}</span>
                              <span className="text-muted-foreground whitespace-nowrap">
                                {slot.reservationTime.slice(0, 5)} - {slot.reservationEndTime.slice(0, 5)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>

    </div>
  );
};
