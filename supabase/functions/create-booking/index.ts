import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface BookingRequest {
  name: string;
  phone: string;
  email?: string;
  date: string; // YYYY-MM-DD format
  time: string; // HH:MM format
  guests: number;
  special_requests?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body: BookingRequest = await req.json();
    console.log("Received booking request:", JSON.stringify(body));

    // Validate required fields
    if (!body.name || typeof body.name !== "string" || body.name.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!body.phone || typeof body.phone !== "string" || body.phone.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Phone is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      return new Response(
        JSON.stringify({ error: "Date is required in YYYY-MM-DD format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!body.time || !/^\d{2}:\d{2}$/.test(body.time)) {
      return new Response(
        JSON.stringify({ error: "Time is required in HH:MM format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!body.guests || typeof body.guests !== "number" || body.guests < 1 || body.guests > 50) {
      return new Response(
        JSON.stringify({ error: "Guests must be a number between 1 and 50" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  // Validate email (required)
  if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return new Response(
      JSON.stringify({ error: "Valid email is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

    // Sanitize inputs
    const sanitizedName = body.name.trim().slice(0, 100);
    const sanitizedPhone = body.phone.trim().slice(0, 30);
  const sanitizedEmail = body.email.trim().slice(0, 255);
    const sanitizedRequests = body.special_requests?.trim().slice(0, 500) || null;

    // Create Supabase client with service role for database operations
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if customer exists, otherwise create
    let customerId: string;
    
    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("id")
      .eq("phone", sanitizedPhone)
      .maybeSingle();

    if (existingCustomer) {
      customerId = existingCustomer.id;
      console.log("Found existing customer:", customerId);
    } else {
      const { data: newCustomer, error: customerError } = await supabase
        .from("customers")
        .insert({
          name: sanitizedName,
          phone: sanitizedPhone,
          email: sanitizedEmail,
        })
        .select("id")
        .single();

      if (customerError) {
        console.error("Error creating customer:", customerError);
        return new Response(
          JSON.stringify({ error: "Failed to create customer record" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      customerId = newCustomer.id;
      console.log("Created new customer:", customerId);
    }

    // Create the reservation
    const { data: reservation, error: reservationError } = await supabase
      .from("reservations")
      .insert({
        customer_id: customerId,
        reservation_date: body.date,
        reservation_time: body.time,
        guests: body.guests,
        source: "website",
        status: "new",
        special_requests: sanitizedRequests,
      })
      .select("id, reservation_date, reservation_time, guests, status")
      .single();

    if (reservationError) {
      console.error("Error creating reservation:", reservationError);
      return new Response(
        JSON.stringify({ error: "Failed to create reservation" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Reservation created successfully:", reservation.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Reservation created successfully",
        reservation: {
          id: reservation.id,
          date: reservation.reservation_date,
          time: reservation.reservation_time,
          guests: reservation.guests,
          status: reservation.status,
        },
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
