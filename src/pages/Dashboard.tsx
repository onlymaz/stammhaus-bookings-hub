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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/95 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 lg:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg gradient-crimson flex items-center justify-center shadow-md">
              <span className="text-primary-foreground font-display text-lg font-bold">S</span>
            </div>
            <div className="flex flex-col">
              <h1 className="font-display text-lg font-bold text-foreground leading-tight">
                Stammhaus
              </h1>
              <span className="text-xs text-muted-foreground hidden sm:inline">
                Reservation System
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="gap-2 shadow-md hover:shadow-lg transition-all"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Reservation</span>
            </Button>

            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-4 w-4" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-accent rounded-full" />
            </Button>

            <Button variant="ghost" size="icon">
              <Settings className="h-4 w-4" />
            </Button>

            <div className="w-px h-6 bg-border mx-1 hidden sm:block" />

            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
            </Button>
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
