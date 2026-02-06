import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Users, LayoutGrid, Clock, Building } from "lucide-react";

interface CapacitySettings {
  id?: string;
  max_guests_per_slot: number;
  max_tables_per_slot: number;
  slot_duration_minutes: number;
  total_restaurant_capacity: number;
}

export function CapacitySettings() {
  const [settings, setSettings] = useState<CapacitySettings>({
    max_guests_per_slot: 20,
    max_tables_per_slot: 10,
    slot_duration_minutes: 15,
    total_restaurant_capacity: 200,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("capacity_settings")
        .select("*")
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error("Error fetching capacity settings:", error);
      toast({ title: "Fehler", description: "Einstellungen konnten nicht geladen werden", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (settings.id) {
        const { error } = await supabase
          .from("capacity_settings")
          .update({
            max_guests_per_slot: settings.max_guests_per_slot,
            max_tables_per_slot: settings.max_tables_per_slot,
            slot_duration_minutes: settings.slot_duration_minutes,
            total_restaurant_capacity: settings.total_restaurant_capacity,
          })
          .eq("id", settings.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("capacity_settings")
          .insert({
            max_guests_per_slot: settings.max_guests_per_slot,
            max_tables_per_slot: settings.max_tables_per_slot,
            slot_duration_minutes: settings.slot_duration_minutes,
            total_restaurant_capacity: settings.total_restaurant_capacity,
          });

        if (error) throw error;
      }

      toast({ title: "Gespeichert", description: "Kapazitätseinstellungen aktualisiert" });
      fetchSettings();
    } catch (error) {
      console.error("Error saving capacity settings:", error);
      toast({ title: "Fehler", description: "Einstellungen konnten nicht gespeichert werden", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof CapacitySettings, value: string) => {
    const numValue = parseInt(value) || 0;
    setSettings((prev) => ({ ...prev, [field]: numValue }));
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
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Maximale Kapazitätsgrenzen für Reservierungen konfigurieren
        </p>
        <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Speichern
        </Button>
      </div>

      <div className="grid gap-4">
        {/* Max Guests Per Slot */}
        <div className="p-4 rounded-lg bg-muted/20 border border-border/50 space-y-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <Label className="font-medium">Max. Gäste pro Zeitfenster</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Maximale Anzahl der Gäste, die in einem Zeitfenster platziert werden können
          </p>
          <Input
            type="number"
            min="1"
            max="500"
            value={settings.max_guests_per_slot}
            onChange={(e) => handleChange("max_guests_per_slot", e.target.value)}
            className="w-32"
          />
        </div>

        {/* Max Tables Per Slot */}
        <div className="p-4 rounded-lg bg-muted/20 border border-border/50 space-y-3">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-primary" />
            <Label className="font-medium">Max. Tische pro Zeitfenster</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Maximale Anzahl der Reservierungen für ein einzelnes Zeitfenster
          </p>
          <Input
            type="number"
            min="1"
            max="100"
            value={settings.max_tables_per_slot}
            onChange={(e) => handleChange("max_tables_per_slot", e.target.value)}
            className="w-32"
          />
        </div>

        {/* Slot Duration */}
        <div className="p-4 rounded-lg bg-muted/20 border border-border/50 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <Label className="font-medium">Zeitfensterdauer</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Dauer jedes Zeitfensters in Minuten (z.B. 15, 30, 60)
          </p>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min="5"
              max="120"
              step="5"
              value={settings.slot_duration_minutes}
              onChange={(e) => handleChange("slot_duration_minutes", e.target.value)}
              className="w-32"
            />
            <span className="text-sm text-muted-foreground">Minuten</span>
          </div>
        </div>

        {/* Total Restaurant Capacity */}
        <div className="p-4 rounded-lg bg-muted/20 border border-border/50 space-y-3">
          <div className="flex items-center gap-2">
            <Building className="h-4 w-4 text-primary" />
            <Label className="font-medium">Gesamtkapazität Restaurant</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Maximale Gesamtzahl der Gäste, die das Restaurant gleichzeitig aufnehmen kann
          </p>
          <Input
            type="number"
            min="1"
            max="1000"
            value={settings.total_restaurant_capacity}
            onChange={(e) => handleChange("total_restaurant_capacity", e.target.value)}
            className="w-32"
          />
        </div>
      </div>
    </div>
  );
}
