-- Create table for daily free tables tracking
CREATE TABLE public.daily_free_tables (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  lunch_free_tables integer NOT NULL DEFAULT 0,
  dinner_free_tables integer NOT NULL DEFAULT 0,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(date)
);

-- Enable RLS
ALTER TABLE public.daily_free_tables ENABLE ROW LEVEL SECURITY;

-- Staff can view free tables
CREATE POLICY "Staff can view free tables"
  ON public.daily_free_tables
  FOR SELECT
  USING (is_staff_or_admin(auth.uid()));

-- Staff can insert free tables
CREATE POLICY "Staff can insert free tables"
  ON public.daily_free_tables
  FOR INSERT
  WITH CHECK (is_staff_or_admin(auth.uid()));

-- Staff can update free tables
CREATE POLICY "Staff can update free tables"
  ON public.daily_free_tables
  FOR UPDATE
  USING (is_staff_or_admin(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_daily_free_tables_updated_at
  BEFORE UPDATE ON public.daily_free_tables
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();