import { useEffect, useMemo, useState } from "react";
import { format, isBefore, isSameDay, startOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Table2, CheckCircle, Clock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface TableWithZone {
  id: string;
  table_number: string;
  zone: 'inside' | 'garden';
  capacity: number;
}

interface ReservedTableInfo {
  tableId: string;
  tableNumber: string;
  zone: 'inside' | 'garden';
  reservationTime: string;
  reservationEndTime: string; // always computed (fallback to start + 90min)
  customerName: string;
}

interface TableStatusSectionProps {
  selectedDate: Date;
  refreshTrigger?: number;
}

export const TableStatusSection = ({ selectedDate, refreshTrigger }: TableStatusSectionProps) => {
  const [allTables, setAllTables] = useState<TableWithZone[]>([]);
  const [reservedTables, setReservedTables] = useState<ReservedTableInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'free' | 'reserved'>('free');
  const [nowTick, setNowTick] = useState(0);

  // Helper to get display name: T1-T46 for inside, TG47-TG84 for garden
  const getTableDisplayName = (table: { table_number: string; zone: 'inside' | 'garden' }) => {
    if (table.zone === 'inside') {
      return `T${table.table_number}`;
    } else {
      return `TG${table.table_number}`;
    }
  };

  // Helper for numeric sorting
  const getTableNumeric = (tableNumber: string) => {
    const num = parseInt(tableNumber, 10);
    return isNaN(num) ? 0 : num;
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

      // Sort tables: inside first, then garden, each numerically
      const sortedTables = (tables || []).sort((a, b) => {
        if (a.zone !== b.zone) return a.zone === 'inside' ? -1 : 1;
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

      // Sort reserved tables
      reserved.sort((a, b) => {
        if (a.zone !== b.zone) return a.zone === 'inside' ? -1 : 1;
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
  const freeInside = freeTables.filter(t => t.zone === 'inside');
  const freeGarden = freeTables.filter(t => t.zone === 'garden');
  const reservedInside = effectiveReservedTables.filter(t => t.zone === 'inside');
  const reservedGarden = effectiveReservedTables.filter(t => t.zone === 'garden');

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
                {freeInside.length > 0 && (
                  <div>
                    <div className="text-[9px] font-medium text-muted-foreground mb-1">Inside ({freeInside.length})</div>
                    <div className="flex flex-wrap gap-1">
                      {freeInside.map(table => (
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
                )}
                {freeGarden.length > 0 && (
                  <div>
                    <div className="text-[9px] font-medium text-muted-foreground mb-1">Garden ({freeGarden.length})</div>
                    <div className="flex flex-wrap gap-1">
                      {freeGarden.map(table => (
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
                )}
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
                {reservedInside.length > 0 && (
                  <div className="text-[9px] font-medium text-muted-foreground mb-1">Inside ({reservedInside.length})</div>
                )}
                {reservedInside.map((rt, idx) => (
                  <div
                    key={`${rt.tableId}-${idx}`}
                    className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-muted/50 text-[10px]"
                  >
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 px-1.5 py-0">
                      {getTableDisplayName({ table_number: rt.tableNumber, zone: rt.zone })}
                    </Badge>
                    <span className="text-muted-foreground truncate flex-1">{rt.customerName}</span>
                    <span className="text-muted-foreground whitespace-nowrap">
                      {rt.reservationTime.slice(0, 5)}
                      {` - ${rt.reservationEndTime.slice(0, 5)}`}
                    </span>
                  </div>
                ))}
                {reservedGarden.length > 0 && (
                  <div className="text-[9px] font-medium text-muted-foreground mb-1 mt-2">Garden ({reservedGarden.length})</div>
                )}
                {reservedGarden.map((rt, idx) => (
                  <div
                    key={`${rt.tableId}-${idx}`}
                    className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-muted/50 text-[10px]"
                  >
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 px-1.5 py-0">
                      {getTableDisplayName({ table_number: rt.tableNumber, zone: rt.zone })}
                    </Badge>
                    <span className="text-muted-foreground truncate flex-1">{rt.customerName}</span>
                    <span className="text-muted-foreground whitespace-nowrap">
                      {rt.reservationTime.slice(0, 5)}
                      {` - ${rt.reservationEndTime.slice(0, 5)}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};
