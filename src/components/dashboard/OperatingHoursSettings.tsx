import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Plus, X, Calendar } from "lucide-react";
import { format } from "date-fns";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface OperatingHour {
  id?: string;
  day_of_week: number;
  lunch_start: string | null;
  lunch_end: string | null;
  dinner_start: string | null;
  dinner_end: string | null;
  is_closed: boolean;
}

interface BlockedDate {
  id: string;
  blocked_date: string;
  reason: string | null;
}

export function OperatingHoursSettings() {
  const [hours, setHours] = useState<OperatingHour[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newBlockedDate, setNewBlockedDate] = useState<Date | undefined>();
  const [newBlockedReason, setNewBlockedReason] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [hoursRes, blockedRes] = await Promise.all([
        supabase.from("operating_hours").select("*").order("day_of_week"),
        supabase.from("blocked_dates").select("*").order("blocked_date"),
      ]);

      if (hoursRes.error) throw hoursRes.error;
      if (blockedRes.error) throw blockedRes.error;

      // Initialize hours for all days if not exists
      const existingHours = hoursRes.data || [];
      const allHours: OperatingHour[] = DAYS.map((_, index) => {
        const existing = existingHours.find((h) => h.day_of_week === index);
        return existing || {
          day_of_week: index,
          lunch_start: "11:00",
          lunch_end: "15:00",
          dinner_start: "17:00",
          dinner_end: "22:00",
          is_closed: false,
        };
      });

      setHours(allHours);
      setBlockedDates(blockedRes.data || []);
    } catch (error) {
      console.error("Error fetching operating hours:", error);
      toast({ title: "Error", description: "Failed to load settings", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleHourChange = (dayIndex: number, field: keyof OperatingHour, value: any) => {
    setHours((prev) =>
      prev.map((h) =>
        h.day_of_week === dayIndex ? { ...h, [field]: value } : h
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const hour of hours) {
        if (hour.id) {
          await supabase.from("operating_hours").update({
            lunch_start: hour.lunch_start,
            lunch_end: hour.lunch_end,
            dinner_start: hour.dinner_start,
            dinner_end: hour.dinner_end,
            is_closed: hour.is_closed,
          }).eq("id", hour.id);
        } else {
          await supabase.from("operating_hours").insert({
            day_of_week: hour.day_of_week,
            lunch_start: hour.lunch_start,
            lunch_end: hour.lunch_end,
            dinner_start: hour.dinner_start,
            dinner_end: hour.dinner_end,
            is_closed: hour.is_closed,
          });
        }
      }
      
      toast({ title: "Saved", description: "Operating hours updated" });
      fetchData();
    } catch (error) {
      console.error("Error saving operating hours:", error);
      toast({ title: "Error", description: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const addBlockedDate = async () => {
    if (!newBlockedDate) return;
    
    try {
      const { error } = await supabase.from("blocked_dates").insert({
        blocked_date: format(newBlockedDate, "yyyy-MM-dd"),
        reason: newBlockedReason || null,
      });

      if (error) throw error;
      
      toast({ title: "Added", description: "Blocked date added" });
      setNewBlockedDate(undefined);
      setNewBlockedReason("");
      fetchData();
    } catch (error) {
      console.error("Error adding blocked date:", error);
      toast({ title: "Error", description: "Failed to add blocked date", variant: "destructive" });
    }
  };

  const removeBlockedDate = async (id: string) => {
    try {
      const { error } = await supabase.from("blocked_dates").delete().eq("id", id);
      if (error) throw error;
      
      toast({ title: "Removed", description: "Blocked date removed" });
      fetchData();
    } catch (error) {
      console.error("Error removing blocked date:", error);
      toast({ title: "Error", description: "Failed to remove", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Weekly Hours */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">Weekly Schedule</h4>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
        </div>

        <div className="space-y-3">
          {hours.map((hour) => (
            <div
              key={hour.day_of_week}
              className={cn(
                "p-3 rounded-lg border border-border/50 transition-colors",
                hour.is_closed ? "bg-muted/50 opacity-60" : "bg-muted/20"
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-sm">{DAYS[hour.day_of_week]}</span>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`closed-${hour.day_of_week}`} className="text-xs text-muted-foreground">
                    Closed
                  </Label>
                  <Switch
                    id={`closed-${hour.day_of_week}`}
                    checked={hour.is_closed}
                    onCheckedChange={(v) => handleHourChange(hour.day_of_week, "is_closed", v)}
                  />
                </div>
              </div>

              {!hour.is_closed && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Lunch</Label>
                    <div className="flex gap-2">
                      <Input
                        type="time"
                        value={hour.lunch_start || ""}
                        onChange={(e) => handleHourChange(hour.day_of_week, "lunch_start", e.target.value)}
                        className="h-8 text-xs"
                      />
                      <span className="text-muted-foreground self-center">-</span>
                      <Input
                        type="time"
                        value={hour.lunch_end || ""}
                        onChange={(e) => handleHourChange(hour.day_of_week, "lunch_end", e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Dinner</Label>
                    <div className="flex gap-2">
                      <Input
                        type="time"
                        value={hour.dinner_start || ""}
                        onChange={(e) => handleHourChange(hour.day_of_week, "dinner_start", e.target.value)}
                        className="h-8 text-xs"
                      />
                      <span className="text-muted-foreground self-center">-</span>
                      <Input
                        type="time"
                        value={hour.dinner_end || ""}
                        onChange={(e) => handleHourChange(hour.day_of_week, "dinner_end", e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Blocked Dates */}
      <div className="space-y-4 pt-4 border-t border-border">
        <h4 className="text-sm font-semibold">Blocked Dates</h4>
        <p className="text-xs text-muted-foreground">
          Add specific dates when the restaurant is closed (holidays, events, etc.)
        </p>

        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 flex-1 justify-start">
                <Calendar className="h-4 w-4" />
                {newBlockedDate ? format(newBlockedDate, "PPP") : "Select date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={newBlockedDate}
                onSelect={setNewBlockedDate}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          <Input
            placeholder="Reason (optional)"
            value={newBlockedReason}
            onChange={(e) => setNewBlockedReason(e.target.value)}
            className="h-9 text-sm flex-1"
          />
          <Button size="sm" onClick={addBlockedDate} disabled={!newBlockedDate}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {blockedDates.length > 0 && (
          <div className="space-y-2">
            {blockedDates.map((bd) => (
              <div
                key={bd.id}
                className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/50"
              >
                <div>
                  <span className="text-sm font-medium">
                    {format(new Date(bd.blocked_date), "EEEE, MMMM d, yyyy")}
                  </span>
                  {bd.reason && (
                    <span className="text-xs text-muted-foreground ml-2">— {bd.reason}</span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => removeBlockedDate(bd.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
