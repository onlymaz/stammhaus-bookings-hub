-- Add zone enum type
CREATE TYPE public.table_zone AS ENUM ('inside', 'garden');

-- Add dining status enum type  
CREATE TYPE public.dining_status AS ENUM ('reserved', 'seated', 'completed', 'cancelled', 'no_show');

-- Expand the existing tables table with zone and capacity
ALTER TABLE public.tables 
ADD COLUMN zone table_zone NOT NULL DEFAULT 'inside',
ADD COLUMN capacity integer NOT NULL DEFAULT 4;

-- Update existing table_number to ensure unique constraint
ALTER TABLE public.tables ADD CONSTRAINT tables_table_number_unique UNIQUE (table_number);

-- Add reservation end time and table allocation columns to reservations
ALTER TABLE public.reservations 
ADD COLUMN reservation_end_time time without time zone,
ADD COLUMN dining_status dining_status NOT NULL DEFAULT 'reserved',
ADD COLUMN assigned_table_id uuid REFERENCES public.tables(id);

-- Create index for efficient overlap queries
CREATE INDEX idx_reservations_table_time ON public.reservations (
  assigned_table_id, 
  reservation_date, 
  reservation_time, 
  reservation_end_time
) WHERE assigned_table_id IS NOT NULL AND status != 'cancelled';

-- Create function to check table availability (no overlapping reservations)
CREATE OR REPLACE FUNCTION public.is_table_available(
  _table_id uuid,
  _date date,
  _start_time time,
  _end_time time,
  _exclude_reservation_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.reservations
    WHERE assigned_table_id = _table_id
      AND reservation_date = _date
      AND status NOT IN ('cancelled', 'no_show')
      AND id != COALESCE(_exclude_reservation_id, '00000000-0000-0000-0000-000000000000'::uuid)
      -- Check for time overlap: existing (start, end) overlaps with requested (start, end)
      AND reservation_time < _end_time
      AND COALESCE(reservation_end_time, reservation_time + interval '90 minutes') > _start_time
  )
$$;

-- Create function to get conflicting reservation details
CREATE OR REPLACE FUNCTION public.get_table_conflict(
  _table_id uuid,
  _date date,
  _start_time time,
  _end_time time,
  _exclude_reservation_id uuid DEFAULT NULL
)
RETURNS TABLE(
  reservation_id uuid,
  start_time time,
  end_time time,
  customer_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    r.id,
    r.reservation_time,
    COALESCE(r.reservation_end_time, r.reservation_time + interval '90 minutes'),
    c.name
  FROM public.reservations r
  JOIN public.customers c ON r.customer_id = c.id
  WHERE r.assigned_table_id = _table_id
    AND r.reservation_date = _date
    AND r.status NOT IN ('cancelled', 'no_show')
    AND r.id != COALESCE(_exclude_reservation_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND r.reservation_time < _end_time
    AND COALESCE(r.reservation_end_time, r.reservation_time + interval '90 minutes') > _start_time
  LIMIT 1
$$;

-- Create function to get all available tables for a time range
CREATE OR REPLACE FUNCTION public.get_available_tables(
  _date date,
  _start_time time,
  _end_time time,
  _zone table_zone DEFAULT NULL,
  _min_capacity integer DEFAULT 1
)
RETURNS SETOF public.tables
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.*
  FROM public.tables t
  WHERE t.is_active = true
    AND t.capacity >= _min_capacity
    AND (_zone IS NULL OR t.zone = _zone)
    AND public.is_table_available(t.id, _date, _start_time, _end_time)
  ORDER BY t.zone, t.table_number
$$;

-- Create trigger function to enforce no double booking on insert/update
CREATE OR REPLACE FUNCTION public.check_table_availability_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conflict_info RECORD;
  end_time time;
BEGIN
  -- Skip if no table assigned
  IF NEW.assigned_table_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Skip cancelled/no_show reservations
  IF NEW.status IN ('cancelled', 'no_show') THEN
    RETURN NEW;
  END IF;
  
  -- Calculate end time (default 90 minutes if not set)
  end_time := COALESCE(NEW.reservation_end_time, NEW.reservation_time + interval '90 minutes');
  
  -- Check for conflicts
  SELECT * INTO conflict_info FROM public.get_table_conflict(
    NEW.assigned_table_id,
    NEW.reservation_date,
    NEW.reservation_time,
    end_time,
    NEW.id
  );
  
  IF conflict_info IS NOT NULL THEN
    RAISE EXCEPTION 'Table is already reserved from % to % by %. Please select another table or time.', 
      conflict_info.start_time, 
      conflict_info.end_time,
      conflict_info.customer_name;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for double booking protection
CREATE TRIGGER enforce_table_availability
  BEFORE INSERT OR UPDATE ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.check_table_availability_trigger();

-- Update RLS policy for tables to allow staff to manage
DROP POLICY IF EXISTS "Admins can manage tables" ON public.tables;
CREATE POLICY "Staff can manage tables" 
ON public.tables 
FOR ALL 
USING (is_staff_or_admin(auth.uid()));

-- Allow viewing all tables for availability checks
DROP POLICY IF EXISTS "Anyone can view active tables" ON public.tables;
CREATE POLICY "Staff can view all tables" 
ON public.tables 
FOR SELECT 
USING (is_staff_or_admin(auth.uid()));