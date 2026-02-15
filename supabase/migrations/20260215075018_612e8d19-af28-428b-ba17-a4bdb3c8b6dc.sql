-- Step 1: Add 'pending' to dining_status enum
ALTER TYPE public.dining_status ADD VALUE IF NOT EXISTS 'pending' BEFORE 'reserved';