import { useEffect, useMemo, useState } from "react";
import { format, isBefore, isSameDay, startOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Table2, CheckCircle, Clock, Home, Building, TreePine, Layers } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TableZone } from "@/types/table";

interface TableWithZone {
  id: string;
  table_number: string;
  zone: TableZone;
  capacity: number;
}

interface ReservedTableInfo {
  tableId: string;
  tableNumber: string;
  zone: TableZone;
  reservationTime: string;
  reservationEndTime: string; // always computed (fallback to start + 90min)
  customerName: string;
}

interface TableStatusSectionProps {
  selectedDate: Date;
  refreshTrigger?: number;
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

export const TableStatusSection = ({ selectedDate, refreshTrigger }: TableStatusSectionProps) => {
  const [allTables, setAllTables] = useState<TableWithZone[]>([]);
  const [reservedTables, setReservedTables] = useState<ReservedTableInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'free' | 'reserved'>('free');
  const [nowTick, setNowTick] = useState(0);

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
    return minutesToTimeStr(timeStrToMinutes(startTime) + 90);
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

      // Fetch all reservations for the day with assigned tables (excluding cancelled/no_show)
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
        .not('status', 'in', '("cancelled","no_show")')
        .not('assigned_table_id', 'is', null);

      if (resError) throw resError;

      // Sort tables by zone order, then numerically
      const sortedTables = (tables || []).sort((a, b) => {
        const zoneA = zoneOrder[a.zone] ?? 99;
        const zoneB = zoneOrder[b.zone] ?? 99;
        if (zoneA !== zoneB) return zoneA - zoneB;
        return getTableNumeric(a.table_number) - getTableNumeric(b.table_number);
      }) as TableWithZone[];

      setAllTables(sortedTables);

      // Map reserved tables with details
      const reserved: ReservedTableInfo[] = (reservations || [])
        .map(res => {
          const table = sortedTables.find(t => t.id === res.assigned_table_id);
          if (!table) return null;
          return {
            tableId: table.id,
            tableNumber: table.table_number,
            zone: table.zone,
            reservationTime: res.reservation_time,
            reservationEndTime: computeEndTime(res.reservation_time, res.reservation_end_time),
            customerName: res.customer?.name || 'Unknown'
          };
        })
        .filter(Boolean) as ReservedTableInfo[];

      // Sort reserved tables by zone order, then numerically
      reserved.sort((a, b) => {
        const zoneA = zoneOrder[a.zone] ?? 99;
        const zoneB = zoneOrder[b.zone] ?? 99;
        if (zoneA !== zoneB) return zoneA - zoneB;
        return getTableNumeric(a.tableNumber) - getTableNumeric(b.tableNumber);
      });

      setReservedTables(reserved);
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

  const effectiveReservedTables = useMemo(() => {
    // keep hook dependency explicit
    void nowTick;

    const today = new Date();
    const selectedDay = startOfDay(selectedDate);
    const todayDay = startOfDay(today);

    // past day => everything ended => all tables free
    if (isBefore(selectedDay, todayDay)) return [];

    // future day => keep "whole day" behavior (show upcoming reservations)
    if (!isSameDay(selectedDate, today)) return reservedTables;

    // today => table is reserved only if reservation has not ended yet
    const nowMinutes = today.getHours() * 60 + today.getMinutes();
    return reservedTables.filter((rt) => timeStrToMinutes(rt.reservationEndTime) > nowMinutes);
  }, [reservedTables, selectedDate, nowTick]);

  // Get unique reserved table IDs
  const reservedTableIds = new Set(effectiveReservedTables.map(rt => rt.tableId));

  // Free tables = all tables - reserved
  const freeTables = allTables.filter(t => !reservedTableIds.has(t.id));

  // Group by zone for display
  const freeByZone = {
    inside: freeTables.filter(t => t.zone === 'inside'),
    room: freeTables.filter(t => t.zone === 'room'),
    garden: freeTables.filter(t => t.zone === 'garden'),
    mezz: freeTables.filter(t => t.zone === 'mezz'),
  };
  const reservedByZone = {
    inside: effectiveReservedTables.filter(t => t.zone === 'inside'),
    room: effectiveReservedTables.filter(t => t.zone === 'room'),
    garden: effectiveReservedTables.filter(t => t.zone === 'garden'),
    mezz: effectiveReservedTables.filter(t => t.zone === 'mezz'),
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
    <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-border/40">
      <div className="flex items-center gap-1.5">
        <Table2 className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10px] text-muted-foreground font-medium">Table Status:</span>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'free' | 'reserved')}>
        <TabsList className="w-full h-7 p-0.5">
          <TabsTrigger value="free" className="flex-1 h-6 text-[10px] gap-1">
            <CheckCircle className="h-3 w-3" />
            Free ({freeTables.length})
          </TabsTrigger>
          <TabsTrigger value="reserved" className="flex-1 h-6 text-[10px] gap-1">
            <Clock className="h-3 w-3" />
            Reserved ({effectiveReservedTables.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="free" className="mt-2">
          <ScrollArea className="h-[120px] rounded border bg-card p-2">
            {freeTables.length === 0 ? (
              <div className="text-[10px] text-muted-foreground text-center py-4">
                No free tables for this day
              </div>
            ) : (
              <div className="space-y-2">
                {allZones.map(zone => {
                  const zoneTables = freeByZone[zone];
                  if (zoneTables.length === 0) return null;
                  const ZoneIcon = zoneLabels[zone].icon;
                  return (
                    <div key={zone}>
                      <div className="text-[9px] font-medium text-muted-foreground mb-1 flex items-center gap-1">
                        <ZoneIcon className="h-2.5 w-2.5" /> {zoneLabels[zone].label} ({zoneTables.length})
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {zoneTables.map(table => (
                          <Badge
                            key={table.id}
                            variant="outline"
                            className="text-[10px] bg-success/10 text-success border-success/30 px-1.5 py-0"
                          >
                            {getTableDisplayName(table)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="reserved" className="mt-2">
          <ScrollArea className="h-[120px] rounded border bg-card p-2">
            {effectiveReservedTables.length === 0 ? (
              <div className="text-[10px] text-muted-foreground text-center py-4">
                No reserved tables for this day
              </div>
            ) : (
              <div className="space-y-1">
                {allZones.map(zone => {
                  const zoneTables = reservedByZone[zone];
                  if (zoneTables.length === 0) return null;
                  const ZoneIcon = zoneLabels[zone].icon;
                  return (
                    <div key={zone}>
                      <div className="text-[9px] font-medium text-muted-foreground mb-1 flex items-center gap-1 mt-2 first:mt-0">
                        <ZoneIcon className="h-2.5 w-2.5" /> {zoneLabels[zone].label} ({zoneTables.length})
                      </div>
                      {zoneTables.map((rt, idx) => (
                        <div
                          key={`${rt.tableId}-${idx}`}
                          className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-muted/50 text-[10px]"
                        >
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 px-1.5 py-0">
                            {getTableDisplayName({ table_number: rt.tableNumber })}
                          </Badge>
                          <span className="text-muted-foreground truncate flex-1">{rt.customerName}</span>
                          <span className="text-muted-foreground whitespace-nowrap">
                            {rt.reservationTime.slice(0, 5)} - {rt.reservationEndTime.slice(0, 5)}
                          </span>
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
