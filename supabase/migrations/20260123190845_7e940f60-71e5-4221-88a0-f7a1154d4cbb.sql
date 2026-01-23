-- Change free tables columns from integer to text to support alphanumeric table identifiers
ALTER TABLE public.daily_free_tables 
  ALTER COLUMN lunch_free_tables TYPE text USING lunch_free_tables::text,
  ALTER COLUMN dinner_free_tables TYPE text USING dinner_free_tables::text;

-- Update default values
ALTER TABLE public.daily_free_tables 
  ALTER COLUMN lunch_free_tables SET DEFAULT '',
  ALTER COLUMN dinner_free_tables SET DEFAULT '';