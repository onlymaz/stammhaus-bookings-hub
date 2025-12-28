import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get yesterday's date (to mark reservations from past dates as completed)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0];

    console.log(`Auto-completing reservations before ${todayStr}`);

    // Update reservations that are "new" or "confirmed" and have a date before today
    const { data, error, count } = await supabase
      .from("reservations")
      .update({ status: "completed" })
      .lt("reservation_date", todayStr)
      .in("status", ["new", "confirmed"])
      .select("id");

    if (error) {
      console.error("Error updating reservations:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const updatedCount = data?.length || 0;
    console.log(`Auto-completed ${updatedCount} reservations`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Auto-completed ${updatedCount} reservations`,
        updated: updatedCount
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
