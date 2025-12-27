import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Plus, LogOut, Bell, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CalendarView } from "@/components/dashboard/CalendarView";
import { CreateReservationDialog } from "@/components/dashboard/CreateReservationDialog";

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      {/* Header */}
      <header className="premium-header backdrop-blur-md sticky top-0 z-50 shadow-xl">
        <div className="container mx-auto px-4 lg:px-6 h-18 flex items-center justify-between py-3">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl gradient-premium flex items-center justify-center shadow-lg glow-primary">
              <span className="text-primary-foreground font-display text-xl font-bold">S</span>
            </div>
            <div className="flex flex-col">
              <h1 className="font-display text-xl font-bold text-foreground leading-tight tracking-tight">
                Stammhaus
              </h1>
              <span className="text-xs text-muted-foreground hidden sm:inline font-medium">
                Restaurant Reservations
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="gap-2 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary px-5"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline font-medium">New Reservation</span>
            </Button>

            <div className="flex items-center gap-1 bg-secondary/50 rounded-xl p-1">
              <Button variant="ghost" size="icon" className="relative rounded-lg hover:bg-secondary">
                <Bell className="h-4 w-4" />
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-accent rounded-full animate-pulse glow-accent" />
              </Button>

              <Button variant="ghost" size="icon" className="rounded-lg hover:bg-secondary">
                <Settings className="h-4 w-4" />
              </Button>

              <div className="w-px h-6 bg-border/50 mx-1 hidden sm:block" />

              <Button variant="ghost" size="icon" onClick={handleSignOut} className="rounded-lg hover:bg-destructive/10 hover:text-destructive">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 lg:px-6 py-6">
        <Tabs defaultValue="calendar" className="w-full">
          <TabsList className="mb-6 bg-secondary/50 p-1">
            <TabsTrigger value="calendar" className="gap-2 data-[state=active]:shadow-sm">
              <Calendar className="h-4 w-4" />
              Calendar
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="animate-fade-in">
            <CalendarView onCreateReservation={() => setShowCreateDialog(true)} />
          </TabsContent>
        </Tabs>
      </main>

      <CreateReservationDialog 
        open={showCreateDialog} 
        onOpenChange={setShowCreateDialog} 
      />
    </div>
  );
};

export default Dashboard;
