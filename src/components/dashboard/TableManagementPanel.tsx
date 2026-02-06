import { useState } from "react";
import { useTableManagement } from "@/hooks/useTableManagement";
import { RestaurantTable, TableZone } from "@/types/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Plus, Edit2, Trash2, Users, TreePine, Home, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const TableManagementPanel = () => {
  const {
    tables,
    loading,
    createTable,
    updateTable,
    deleteTable,
    insideTables,
    gardenTables,
    totalCapacity
  } = useTableManagement();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(null);
  const [tableToDelete, setTableToDelete] = useState<RestaurantTable | null>(null);
  
  // Form state
  const [tableNumber, setTableNumber] = useState("");
  const [capacity, setCapacity] = useState(4);
  const [zone, setZone] = useState<TableZone>("inside");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setTableNumber("");
    setCapacity(4);
    setZone("inside");
    setIsActive(true);
    setEditingTable(null);
  };

  const openAddDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (table: RestaurantTable) => {
    setEditingTable(table);
    setTableNumber(table.table_number);
    setCapacity(table.capacity);
    setZone(table.zone);
    setIsActive(table.is_active);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!tableNumber.trim()) return;

    setSaving(true);
    let success = false;

    if (editingTable) {
      success = await updateTable(editingTable.id, {
        table_number: tableNumber.trim(),
        capacity,
        zone,
        is_active: isActive
      });
    } else {
      success = await createTable(tableNumber.trim(), capacity, zone);
    }

    setSaving(false);
    if (success) {
      setDialogOpen(false);
      resetForm();
    }
  };

  const handleDelete = async () => {
    if (!tableToDelete) return;
    await deleteTable(tableToDelete.id);
    setDeleteDialogOpen(false);
    setTableToDelete(null);
  };

  const TableCard = ({ table }: { table: RestaurantTable }) => (
    <div
      className={cn(
        "p-3 rounded-lg border-2 transition-all duration-200 group hover:shadow-md",
        table.is_active 
          ? "bg-card border-border/50 hover:border-primary/30"
          : "bg-muted/50 border-muted opacity-60"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Badge 
            variant="outline" 
            className={cn(
              "font-bold",
              table.zone === 'inside' 
                ? "border-blue-500/30 text-blue-600 bg-blue-500/10"
                : "border-green-500/30 text-green-600 bg-green-500/10"
            )}
          >
            {table.table_number}
          </Badge>
          {!table.is_active && (
            <Badge variant="secondary" className="text-[10px]">Inaktiv</Badge>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 hover:bg-primary/10 hover:text-primary"
            onClick={() => openEditDialog(table)}
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
            onClick={() => {
              setTableToDelete(table);
              setDeleteDialogOpen(true);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5" />
        <span>{table.capacity} Plätze</span>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Home className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-600">{insideTables.length} Innen</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
            <TreePine className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-600">{gardenTables.length} Garten</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{totalCapacity} Gesamtkapazität</span>
          </div>
        </div>
        <Button onClick={openAddDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          Tisch hinzufügen
        </Button>
      </div>

      {/* Tables by Zone */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Inside Tables */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Home className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-lg">Innentische</CardTitle>
              <Badge variant="secondary" className="ml-auto">{insideTables.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {insideTables.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Noch keine Innentische</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {tables.filter(t => t.zone === 'inside').map(table => (
                  <TableCard key={table.id} table={table} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Garden Tables */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <TreePine className="h-5 w-5 text-green-600" />
              <CardTitle className="text-lg">Gartentische</CardTitle>
              <Badge variant="secondary" className="ml-auto">{gardenTables.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {gardenTables.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Noch keine Gartentische</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {tables.filter(t => t.zone === 'garden').map(table => (
                  <TableCard key={table.id} table={table} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTable ? "Tisch bearbeiten" : "Neuen Tisch hinzufügen"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tableNumber">Tischnummer / Name</Label>
              <Input
                id="tableNumber"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="z.B. T1, A1, Garten-1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="capacity">Kapazität (Plätze)</Label>
              <Input
                id="capacity"
                type="number"
                min={1}
                max={20}
                value={capacity}
                onChange={(e) => setCapacity(parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-2">
              <Label>Bereich</Label>
              <Select value={zone} onValueChange={(v) => setZone(v as TableZone)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inside">
                    <div className="flex items-center gap-2">
                      <Home className="h-4 w-4 text-blue-600" />
                      Innen
                    </div>
                  </SelectItem>
                  <SelectItem value="garden">
                    <div className="flex items-center gap-2">
                      <TreePine className="h-4 w-4 text-green-600" />
                      Garten
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editingTable && (
              <div className="flex items-center justify-between">
                <Label htmlFor="isActive">Aktiv</Label>
                <Switch
                  id="isActive"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={!tableNumber.trim() || saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingTable ? "Änderungen speichern" : "Tisch hinzufügen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tisch löschen</AlertDialogTitle>
            <AlertDialogDescription>
              Sind Sie sicher, dass Sie Tisch <strong>{tableToDelete?.table_number}</strong> löschen möchten?
              Der Tisch wird aus allen zukünftigen Reservierungen entfernt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
