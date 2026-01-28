import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { format, startOfWeek } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { Plus, LogOut, Bell, Settings, X, Users, Gauge, Table2, Clock, CalendarDays, ChevronDown, BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CalendarView } from "@/components/dashboard/CalendarView";
import { CreateReservationDialog } from "@/components/dashboard/CreateReservationDialog";
import { TeamManagement } from "@/components/dashboard/TeamManagement";
import { CapacitySettings } from "@/components/dashboard/CapacitySettings";
import { TableManagementPanel } from "@/components/dashboard/TableManagementPanel";
import { TableStatusSection } from "@/components/dashboard/TableStatusSection";

import { useAuth } from "@/contexts/AuthContext";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

type ActiveTab = "bookings" | "calendar";

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [websiteNotifCount, setWebsiteNotifCount] = useState(0);
  const [settingsTab, setSettingsTab] = useState<"preferences" | "team" | "capacity" | "tables">("preferences");
  const [calendarRefresh, setCalendarRefresh] = useState(0);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [soundAlerts, setSoundAlerts] = useState(false);
  const [notifPopoverOpen, setNotifPopoverOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastNotifiedIdsRef = useRef<Set<string>>(new Set());
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Lifted state for header
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<ActiveTab>("bookings");
  const [calendarPopoverOpen, setCalendarPopoverOpen] = useState(false);
  const [tablesPopoverOpen, setTablesPopoverOpen] = useState(false);
  const [dailyStats, setDailyStats] = useState({ guests: 0, bookings: 0 });

  // Fetch preferences from DB once user is available
  const fetchPreferences = async (userId: string) => {
    const { data } = await supabase
      .from("user_preferences")
      .select("email_notifications, sound_alerts")
      .eq("user_id", userId)
      .maybeSingle();

    if (data) {
      setEmailNotifications(data.email_notifications);
      setSoundAlerts(data.sound_alerts);
    } else {
      // Create default row if not exists
      await supabase.from("user_preferences").insert({
        user_id: userId,
        email_notifications: true,
        sound_alerts: false,
      });
    }
  };

  const updatePreference = async (field: "email_notifications" | "sound_alerts", value: boolean) => {
    if (!user) return;
    await supabase
      .from("user_preferences")
      .update({ [field]: value })
      .eq("user_id", user.id);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session) {
        navigate("/auth");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Initialize notification sound
  useEffect(() => {
    audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
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
    if (soundAlerts && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(err => {
        console.log("Audio play failed:", err);
      });
    }
  }, [soundAlerts]);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      fetchPreferences(user.id);
    }
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_read", false)
      .order("created_at", { ascending: false })
      .limit(10);
    
    if (data) {
      setNotifications(data);
      // Count website notifications specifically
      const websiteCount = data.filter(n => 
        n.title?.toLowerCase().includes("website")
      ).length;
      setWebsiteNotifCount(websiteCount);
      
      // Track which notifications we've already seen
      data.forEach(n => lastNotifiedIdsRef.current.add(n.id));
    }
  };

  // Subscribe to realtime notifications for website reservations
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('website-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          const newNotif = payload.new as any;
          
          // Only process if it's for this user and is unread
          if (newNotif.user_id === user.id && !newNotif.is_read) {
            // Check if it's a website notification
            const isWebsite = newNotif.title?.toLowerCase().includes("website");
            
            // Avoid duplicate processing
            if (!lastNotifiedIdsRef.current.has(newNotif.id)) {
              lastNotifiedIdsRef.current.add(newNotif.id);
              
              setNotifications(prev => [newNotif, ...prev]);
              
              if (isWebsite) {
                setWebsiteNotifCount(prev => prev + 1);
                
                // Play sound for website reservations
                playNotificationSound();
                
                // Show toast
                toast({
                  title: "🔔 " + newNotif.title,
                  description: newNotif.message,
                });
                
                // Refresh calendar to show new reservation
                setCalendarRefresh(prev => prev + 1);
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, playNotificationSound, toast]);

  const markAsRead = async (id: string) => {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);
    
    const notif = notifications.find(n => n.id === id);
    if (notif?.title?.toLowerCase().includes("website")) {
      setWebsiteNotifCount(prev => Math.max(0, prev - 1));
    }
    
    setNotifications(notifications.filter(n => n.id !== id));
  };

  const markAllAsRead = async () => {
    if (!user || notifications.length === 0) return;
    
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    
    setNotifications([]);
    setWebsiteNotifCount(0);
    lastNotifiedIdsRef.current.clear();
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({ title: "Signed out successfully" });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const resetToToday = () => {
    const today = new Date();
    setSelectedDate(today);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      {/* Header */}
      <header className="premium-header backdrop-blur-md sticky top-0 z-50 shadow-xl">
        <div className="container mx-auto px-4 lg:px-6 flex items-center justify-between py-2 gap-2 flex-wrap">
          {/* Left: Date + Tabs + Stats */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Date badge - clickable to go to today */}
            <div 
              className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={resetToToday}
              title="Click to go to today"
            >
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md flex-shrink-0">
                <span className="text-primary-foreground font-bold text-sm">
                  {format(selectedDate, "d")}
                </span>
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-semibold leading-tight">
                  {format(selectedDate, "EEE")}
                </p>
                <p className="text-xs text-muted-foreground leading-tight">
                  {format(selectedDate, "MMM yyyy")}
                </p>
              </div>
            </div>

            {/* Tabs: Bookings / Calendar */}
            <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-0.5">
              <Button
                variant={activeTab === "bookings" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("bookings")}
                className={cn(
                  "gap-1.5 h-8 px-3 text-xs rounded-md",
                  activeTab === "bookings" && "shadow-sm"
                )}
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Bookings</span>
              </Button>
              
              <Popover open={calendarPopoverOpen} onOpenChange={setCalendarPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant={activeTab === "calendar" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setActiveTab("calendar")}
                    className={cn(
                      "gap-1.5 h-8 px-3 text-xs rounded-md",
                      activeTab === "calendar" && "shadow-sm"
                    )}
                  >
                    <CalendarDays className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Calendar</span>
                    <ChevronDown className={cn(
                      "h-3 w-3 transition-transform",
                      calendarPopoverOpen && "rotate-180"
                    )} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-[320px] p-3 z-[100] bg-card border border-border shadow-2xl" 
                  align="start"
                  sideOffset={8}
                >
                  <p className="text-sm text-muted-foreground text-center py-4">Calendar opens in main view</p>
                </PopoverContent>
              </Popover>

              {/* Tables button with dropdown */}
              <Popover open={tablesPopoverOpen} onOpenChange={setTablesPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant={tablesPopoverOpen ? "default" : "ghost"}
                    size="sm"
                    className={cn(
                      "gap-1.5 h-8 px-3 text-xs rounded-md",
                      tablesPopoverOpen && "shadow-sm"
                    )}
                  >
                    <Table2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Tables</span>
                    <ChevronDown className={cn(
                      "h-3 w-3 transition-transform",
                      tablesPopoverOpen && "rotate-180"
                    )} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-[90vw] max-w-[800px] p-0 z-[100] bg-card border border-border shadow-2xl" 
                  align="start"
                  sideOffset={8}
                >
                  <div className="p-4">
                    <TableStatusSection 
                      selectedDate={selectedDate} 
                      refreshTrigger={calendarRefresh} 
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Stats badges */}
            {dailyStats.bookings > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1 py-1 px-2 rounded-md bg-muted/60 text-xs">
                  <Users className="h-3 w-3 text-primary" />
                  <span className="font-semibold">{dailyStats.guests}</span>
                  <span className="text-muted-foreground hidden sm:inline">guests</span>
                </div>
                <div className="flex items-center gap-1 py-1 px-2 rounded-md bg-muted/60 text-xs">
                  <Clock className="h-3 w-3 text-accent" />
                  <span className="font-semibold">{dailyStats.bookings}</span>
                  <span className="text-muted-foreground hidden sm:inline">bookings</span>
                </div>
              </div>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              onClick={() => setShowCreateDialog(true)}
              size="sm"
              className="gap-1.5 shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary h-8 px-3"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs font-medium">New</span>
            </Button>

            <div className="flex items-center gap-1 bg-secondary/50 rounded-xl p-1">
              {/* Notifications */}
              <Popover open={notifPopoverOpen} onOpenChange={(open) => {
                setNotifPopoverOpen(open);
                // Mark all as read when closing the popover
                if (!open && websiteNotifCount > 0) {
                  markAllAsRead();
                }
              }}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative rounded-lg hover:bg-secondary">
                    <Bell className="h-4 w-4" />
                    {websiteNotifCount > 0 && (
                      <Badge 
                        variant="destructive" 
                        className="absolute -top-1.5 -right-1.5 h-5 min-w-5 px-1.5 text-xs font-bold flex items-center justify-center rounded-full animate-pulse"
                      >
                        {websiteNotifCount > 99 ? "99+" : websiteNotifCount}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0 z-[100]" align="end" sideOffset={8}>
                  <div className="p-4 border-b border-border flex items-center justify-between">
                    <h4 className="font-semibold">Notifications</h4>
                    {notifications.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => {
                          markAllAsRead();
                          setNotifPopoverOpen(false);
                        }}
                      >
                        Mark all read
                      </Button>
                    )}
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-muted-foreground">
                        <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No new notifications</p>
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div key={notif.id} className="p-3 border-b border-border/50 hover:bg-muted/50 transition-colors">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm">{notif.title}</p>
                                {notif.title?.toLowerCase().includes("website") && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">Website</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0"
                              onClick={() => markAsRead(notif.id)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Settings */}
              <Sheet onOpenChange={() => setSettingsTab("preferences")}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-lg hover:bg-secondary">
                    <Settings className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-[400px] sm:w-[450px]">
                  <SheetHeader>
                    <SheetTitle className="font-display">Settings</SheetTitle>
                  </SheetHeader>
                  
                  {isAdmin && (
                    <div className="flex gap-2 mt-4 border-b border-border pb-4 flex-wrap">
                      <Button
                        variant={settingsTab === "preferences" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setSettingsTab("preferences")}
                        className="gap-2"
                      >
                        <Settings className="h-4 w-4" />
                        Preferences
                      </Button>
                      <Button
                        variant={settingsTab === "team" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setSettingsTab("team")}
                        className="gap-2"
                      >
                        <Users className="h-4 w-4" />
                        Team
                      </Button>
                      <Button
                        variant={settingsTab === "capacity" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setSettingsTab("capacity")}
                        className="gap-2"
                      >
                        <Gauge className="h-4 w-4" />
                        Capacity
                      </Button>
                      <Button
                        variant={settingsTab === "tables" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setSettingsTab("tables")}
                        className="gap-2"
                      >
                        <Table2 className="h-4 w-4" />
                        Tables
                      </Button>
                    </div>
                  )}

                  {settingsTab === "preferences" ? (
                    <div className="py-6 space-y-6">
                      <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                          Notifications
                        </h3>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="email-notif" className="flex-1">
                            Email notifications
                            <p className="text-xs text-muted-foreground font-normal mt-0.5">
                              Receive email for new reservations
                            </p>
                          </Label>
                          <Switch 
                            id="email-notif" 
                            checked={emailNotifications}
                            onCheckedChange={(checked) => {
                              setEmailNotifications(checked);
                              updatePreference("email_notifications", checked);
                            }}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="sound-notif" className="flex-1">
                            Sound alerts
                            <p className="text-xs text-muted-foreground font-normal mt-0.5">
                              Play sound for new bookings
                            </p>
                          </Label>
                          <Switch 
                            id="sound-notif" 
                            checked={soundAlerts}
                            onCheckedChange={(checked) => {
                              setSoundAlerts(checked);
                              updatePreference("sound_alerts", checked);
                            }}
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                          Account
                        </h3>
                        <div className="p-4 rounded-xl bg-muted/50 border border-border">
                          <p className="text-sm font-medium">{user?.email}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Logged in as {isAdmin ? "admin" : "staff"}
                          </p>
                        </div>
                      </div>

                      <Button 
                        variant="destructive" 
                        className="w-full gap-2"
                        onClick={handleSignOut}
                      >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </Button>
                    </div>
                  ) : settingsTab === "team" ? (
                    <div className="py-6">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                        Team Management
                      </h3>
                      <TeamManagement />
                    </div>
                  ) : settingsTab === "capacity" ? (
                    <div className="py-6">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                        Capacity Settings
                      </h3>
                      <CapacitySettings />
                    </div>
                  ) : (
                    <div className="py-6">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                        Table Management
                      </h3>
                      <TableManagementPanel />
                    </div>
                  )}
                </SheetContent>
              </Sheet>

              <div className="w-px h-6 bg-border/50 mx-1 hidden sm:block" />

              <Button variant="ghost" size="icon" onClick={handleSignOut} className="rounded-lg hover:bg-destructive/10 hover:text-destructive">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 lg:px-6 py-4">
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 animate-fade-in">
          <CalendarView 
            onCreateReservation={() => setShowCreateDialog(true)} 
            refreshTrigger={calendarRefresh}
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            activeTab={activeTab}
            calendarPopoverOpen={calendarPopoverOpen}
            onCalendarPopoverChange={setCalendarPopoverOpen}
            onStatsChange={setDailyStats}
          />
        </div>
      </main>

      <CreateReservationDialog 
        open={showCreateDialog} 
        onOpenChange={setShowCreateDialog} 
      />
    </div>
  );
};

export default Dashboard;
