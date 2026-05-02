-- Update default booking duration from 120 minutes (2h) to 180 minutes (3h)

CREATE OR REPLACE FUNCTION public.is_table_available(_table_id uuid, _date date, _start_time time without time zone, _end_time time without time zone, _exclude_reservation_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.reservations r
    WHERE r.reservation_date = _date
      AND r.status NOT IN ('cancelled', 'no_show')
      AND r.id != COALESCE(_exclude_reservation_id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND r.reservation_time < _end_time
      AND COALESCE(r.reservation_end_time, r.reservation_time + interval '180 minutes') > _start_time
      AND (
        r.assigned_table_id = _table_id
        OR EXISTS (
          SELECT 1 FROM public.reservation_tables rt 
          WHERE rt.reservation_id = r.id AND rt.table_id = _table_id
        )
      )
  )
$function$;

CREATE OR REPLACE FUNCTION public.get_table_conflict(_table_id uuid, _date date, _start_time time without time zone, _end_time time without time zone, _exclude_reservation_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(reservation_id uuid, start_time time without time zone, end_time time without time zone, customer_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    r.id,
    r.reservation_time,
    COALESCE(r.reservation_end_time, r.reservation_time + interval '180 minutes'),
    c.name
  FROM public.reservations r
  JOIN public.customers c ON r.customer_id = c.id
  WHERE r.reservation_date = _date
    AND r.status NOT IN ('cancelled', 'no_show')
    AND r.id != COALESCE(_exclude_reservation_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND r.reservation_time < _end_time
    AND COALESCE(r.reservation_end_time, r.reservation_time + interval '180 minutes') > _start_time
    AND (
      r.assigned_table_id = _table_id
      OR EXISTS (
        SELECT 1 FROM public.reservation_tables rt 
        WHERE rt.reservation_id = r.id AND rt.table_id = _table_id
      )
    )
  LIMIT 1
$function$;

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
  IF NEW.assigned_table_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  IF NEW.status IN ('cancelled', 'no_show') THEN
    RETURN NEW;
  END IF;
  
  end_time := COALESCE(NEW.reservation_end_time, NEW.reservation_time + interval '180 minutes');
  
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