-- Step 2: Change default dining_status to 'pending'
ALTER TABLE public.reservations ALTER COLUMN dining_status SET DEFAULT 'pending'::dining_status;