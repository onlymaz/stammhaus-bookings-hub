import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all tables
    const { data: tables, error: tablesError } = await supabase
      .from("tables")
      .select("id, table_number");

    if (tablesError) throw tablesError;

    // Create a map: normalized table number -> table id
    // e.g., "T31" -> id, "T01" -> id (match both T31 and T01 to same)
    const tableMap = new Map<string, string>();
    for (const t of tables || []) {
      // Store with leading zeros stripped: T01 -> T1
      const normalized = t.table_number.replace(/^([A-Za-z]+)0*(\d+)$/, "$1$2").toUpperCase();
      tableMap.set(normalized, t.id);
      // Also store original for exact matches
      tableMap.set(t.table_number.toUpperCase(), t.id);
    }

    // Fetch reservations with notes that might contain table numbers
    const { data: reservations, error: resError } = await supabase
      .from("reservations")
      .select("id, notes, assigned_table_id")
      .not("notes", "is", null)
      .is("assigned_table_id", null);

    if (resError) throw resError;

    const results: { reservationId: string; parsedTables: string[]; assigned: boolean }[] = [];

    for (const res of reservations || []) {
      if (!res.notes) continue;

      // Parse table numbers from notes: T31, T 31, T12+13, t34, etc.
      const noteUpper = res.notes.toUpperCase();
      // Match patterns like T31, T 31, T12, etc.
      const matches = noteUpper.match(/[TRGM]\s*\d+/g);
      
      if (!matches || matches.length === 0) continue;

      const tableIds: string[] = [];
      const parsedTables: string[] = [];

      for (const match of matches) {
        // Normalize: remove spaces, e.g., "T 31" -> "T31"
        const normalized = match.replace(/\s+/g, "");
        parsedTables.push(normalized);
        
        const tableId = tableMap.get(normalized);
        if (tableId) {
          tableIds.push(tableId);
        }
      }

      if (tableIds.length === 0) {
        results.push({ reservationId: res.id, parsedTables, assigned: false });
        continue;
      }

      // Assign first table to assigned_table_id
      const { error: updateError } = await supabase
        .from("reservations")
        .update({ assigned_table_id: tableIds[0] })
        .eq("id", res.id);

      if (updateError) {
        console.error("Error updating reservation:", updateError);
        results.push({ reservationId: res.id, parsedTables, assigned: false });
        continue;
      }

      // If multiple tables, also add to reservation_tables junction
      if (tableIds.length > 0) {
        // First clear any existing
        await supabase
          .from("reservation_tables")
          .delete()
          .eq("reservation_id", res.id);

        // Insert all
        const insertData = tableIds.map(tid => ({
          reservation_id: res.id,
          table_id: tid
        }));

        await supabase
          .from("reservation_tables")
          .insert(insertData);
      }

      results.push({ reservationId: res.id, parsedTables, assigned: true });
    }

    const assignedCount = results.filter(r => r.assigned).length;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Migrated ${assignedCount} reservations with table assignments`,
        total: results.length,
        assigned: assignedCount,
        details: results
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
