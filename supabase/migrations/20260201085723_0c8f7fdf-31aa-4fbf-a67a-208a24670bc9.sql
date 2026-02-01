-- Update the trigger function to use 120 minutes (2 hours) default instead of 90 minutes
CREATE OR REPLACE FUNCTION public.check_table_availability_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  
  -- Calculate end time (default 120 minutes / 2 hours if not set)
  end_time := COALESCE(NEW.reservation_end_time, NEW.reservation_time + interval '120 minutes');
  
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
$function$;