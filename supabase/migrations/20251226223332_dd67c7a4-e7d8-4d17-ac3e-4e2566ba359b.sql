-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'staff');

-- Create profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table (secure role storage)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Create customers table
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create tables table (restaurant tables)
CREATE TABLE public.tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number TEXT NOT NULL UNIQUE,
  seats INT NOT NULL DEFAULT 4,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create reservations table
CREATE TABLE public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  reservation_date DATE NOT NULL,
  reservation_time TIME NOT NULL,
  guests INT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('website', 'phone')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'confirmed', 'completed', 'cancelled', 'no_show')),
  notes TEXT,
  special_requests TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create reservation_tables junction table
CREATE TABLE public.reservation_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reservation_id, table_id)
);

-- Create operating_hours table
CREATE TABLE public.operating_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week INT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  is_closed BOOLEAN NOT NULL DEFAULT false,
  lunch_start TIME,
  lunch_end TIME,
  dinner_start TIME,
  dinner_end TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (day_of_week)
);

-- Create capacity_settings table
CREATE TABLE public.capacity_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  max_guests_per_slot INT NOT NULL DEFAULT 20,
  max_tables_per_slot INT NOT NULL DEFAULT 10,
  total_restaurant_capacity INT NOT NULL DEFAULT 200,
  slot_duration_minutes INT NOT NULL DEFAULT 15,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create blocked_dates table
CREATE TABLE public.blocked_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocked_date DATE NOT NULL UNIQUE,
  reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES public.reservations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operating_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capacity_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to check if user is staff or admin
CREATE OR REPLACE FUNCTION public.is_staff_or_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'staff')
  )
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Staff can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_staff_or_admin(auth.uid()));

-- RLS Policies for user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for customers (staff/admin only)
CREATE POLICY "Staff can view customers" ON public.customers
  FOR SELECT USING (public.is_staff_or_admin(auth.uid()));

CREATE POLICY "Staff can create customers" ON public.customers
  FOR INSERT WITH CHECK (public.is_staff_or_admin(auth.uid()));

CREATE POLICY "Staff can update customers" ON public.customers
  FOR UPDATE USING (public.is_staff_or_admin(auth.uid()));

-- Allow anonymous inserts for website bookings
CREATE POLICY "Anyone can create customers for booking" ON public.customers
  FOR INSERT WITH CHECK (true);

-- RLS Policies for tables
CREATE POLICY "Anyone can view active tables" ON public.tables
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage tables" ON public.tables
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for reservations
CREATE POLICY "Staff can view all reservations" ON public.reservations
  FOR SELECT USING (public.is_staff_or_admin(auth.uid()));

CREATE POLICY "Staff can manage reservations" ON public.reservations
  FOR ALL USING (public.is_staff_or_admin(auth.uid()));

-- Allow anonymous inserts for website bookings
CREATE POLICY "Anyone can create reservations" ON public.reservations
  FOR INSERT WITH CHECK (true);

-- RLS Policies for reservation_tables
CREATE POLICY "Staff can view reservation tables" ON public.reservation_tables
  FOR SELECT USING (public.is_staff_or_admin(auth.uid()));

CREATE POLICY "Staff can manage reservation tables" ON public.reservation_tables
  FOR ALL USING (public.is_staff_or_admin(auth.uid()));

-- RLS Policies for operating_hours
CREATE POLICY "Anyone can view operating hours" ON public.operating_hours
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage operating hours" ON public.operating_hours
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for capacity_settings
CREATE POLICY "Anyone can view capacity settings" ON public.capacity_settings
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage capacity settings" ON public.capacity_settings
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for blocked_dates
CREATE POLICY "Anyone can view blocked dates" ON public.blocked_dates
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage blocked dates" ON public.blocked_dates
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for notifications
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications" ON public.notifications
  FOR INSERT WITH CHECK (public.is_staff_or_admin(auth.uid()));

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add triggers for updated_at
CREATE TRIGGER handle_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_reservations_updated_at
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_operating_hours_updated_at
  BEFORE UPDATE ON public.operating_hours
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_capacity_settings_updated_at
  BEFORE UPDATE ON public.capacity_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email), NEW.email);
  RETURN NEW;
END;
$$;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert default capacity settings
INSERT INTO public.capacity_settings (max_guests_per_slot, max_tables_per_slot, total_restaurant_capacity, slot_duration_minutes)
VALUES (20, 10, 200, 15);

-- Insert default operating hours (Mon-Sun, closed Mondays)
INSERT INTO public.operating_hours (day_of_week, is_closed, lunch_start, lunch_end, dinner_start, dinner_end) VALUES
  (0, true, NULL, NULL, NULL, NULL), -- Sunday closed
  (1, true, NULL, NULL, NULL, NULL), -- Monday closed
  (2, false, '11:30', '14:30', '17:30', '22:00'), -- Tuesday
  (3, false, '11:30', '14:30', '17:30', '22:00'), -- Wednesday
  (4, false, '11:30', '14:30', '17:30', '22:00'), -- Thursday
  (5, false, '11:30', '14:30', '17:30', '23:00'), -- Friday
  (6, false, '11:30', '14:30', '17:30', '23:00'); -- Saturday

-- Insert sample tables
INSERT INTO public.tables (table_number, seats) VALUES
  ('T1', 2), ('T2', 2), ('T3', 4), ('T4', 4), ('T5', 4),
  ('T6', 6), ('T7', 6), ('T8', 8), ('T9', 8), ('T10', 10);

-- Enable realtime for reservations
ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;