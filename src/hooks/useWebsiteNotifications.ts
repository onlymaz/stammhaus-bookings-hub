import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Notification sound - using a base64 encoded beep sound for cross-platform compatibility
const NOTIFICATION_SOUND_BASE64 = "data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU..." // Placeholder - we'll use a proper beep

interface WebsiteNotificationOptions {
  userId: string | null;
  soundEnabled: boolean;
  onNewReservation?: () => void;
}

export function useWebsiteNotifications({ userId, soundEnabled, onNewReservation }: WebsiteNotificationOptions) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [websiteReservations, setWebsiteReservations] = useState<any[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();
  const lastNotifiedRef = useRef<Set<string>>(new Set());

  // Initialize audio element
  useEffect(() => {
    // Create a simple beep using Web Audio API for better cross-platform support
    audioRef.current = new Audio();
    // Using a publicly available notification sound
    audioRef.current.src = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";
    audioRef.current.load();
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    if (soundEnabled && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(err => {
        console.log("Audio play failed (user interaction may be required):", err);
      });
    }
  }, [soundEnabled]);

  // Fetch unread website reservation count
  const fetchUnreadCount = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from("notifications")
      .select("id, reservation_id, title, message, created_at")
      .eq("user_id", userId)
      .eq("is_read", false)
      .order("created_at", { ascending: false });

    if (!error && data) {
      // Filter for website-related notifications
      const websiteNotifs = data.filter(n => 
        n.title?.toLowerCase().includes("website") || 
        n.message?.toLowerCase().includes("website")
      );
      setUnreadCount(websiteNotifs.length);
      setWebsiteReservations(data);
    }
  }, [userId]);

  // Mark all website notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!userId) return;

    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    setUnreadCount(0);
    setWebsiteReservations([]);
    lastNotifiedRef.current.clear();
  }, [userId]);

  // Mark single notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

    setWebsiteReservations(prev => prev.filter(n => n.id !== notificationId));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  // Listen for new website reservations via realtime
  useEffect(() => {
    if (!userId) return;

    // Initial fetch
    fetchUnreadCount();

    // Subscribe to new reservations from website
    const reservationChannel = supabase
      .channel('website-reservations')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'reservations',
          filter: 'source=eq.website'
        },
        async (payload) => {
          console.log("New website reservation received:", payload);
          
          const reservation = payload.new;
          
          // Avoid duplicate notifications
          if (lastNotifiedRef.current.has(reservation.id)) return;
          lastNotifiedRef.current.add(reservation.id);

          // Fetch customer name for the notification
          const { data: customer } = await supabase
            .from("customers")
            .select("name, phone")
            .eq("id", reservation.customer_id)
            .single();

          const customerName = customer?.name || "A customer";
          const customerPhone = customer?.phone || "";

          // Create notification in database for all staff/admin users
          const { data: staffUsers } = await supabase
            .from("user_roles")
            .select("user_id")
            .in("role", ["admin", "staff"]);

          if (staffUsers) {
            for (const staffUser of staffUsers) {
              await supabase.from("notifications").insert({
                user_id: staffUser.user_id,
                title: "New Website Reservation",
                message: `${customerName} (${customerPhone}) booked for ${reservation.reservation_date} at ${reservation.reservation_time} - ${reservation.guests} guests`,
                reservation_id: reservation.id,
                is_read: false,
              });
            }
          }

          // Play sound immediately
          playNotificationSound();

          // Update local count
          setUnreadCount(prev => prev + 1);

          // Show toast notification
          toast({
            title: "🔔 New Website Reservation",
            description: `${customerName} booked for ${reservation.reservation_date} at ${reservation.reservation_time}`,
          });

          // Callback to refresh data
          onNewReservation?.();
        }
      )
      .subscribe();

    // Also subscribe to notifications table for this user
    const notificationChannel = supabase
      .channel('user-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          const notif = payload.new;
          if (notif.user_id === userId && !notif.is_read) {
            // Check if it's a website notification
            if (notif.title?.toLowerCase().includes("website")) {
              setUnreadCount(prev => prev + 1);
              setWebsiteReservations(prev => [notif, ...prev]);
              playNotificationSound();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(reservationChannel);
      supabase.removeChannel(notificationChannel);
    };
  }, [userId, fetchUnreadCount, playNotificationSound, toast, onNewReservation]);

  return {
    unreadCount,
    websiteReservations,
    markAllAsRead,
    markAsRead,
    refetch: fetchUnreadCount,
  };
}
