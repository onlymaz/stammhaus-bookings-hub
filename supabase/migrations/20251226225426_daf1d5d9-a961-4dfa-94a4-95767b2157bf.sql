-- Drop the restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Anyone can create customers for booking" ON public.customers;
DROP POLICY IF EXISTS "Staff can create customers" ON public.customers;

-- Create a single permissive policy for staff to create customers
CREATE POLICY "Staff can create customers" 
ON public.customers 
FOR INSERT 
TO authenticated
WITH CHECK (is_staff_or_admin(auth.uid()));

-- Also fix reservations insert policy for staff
DROP POLICY IF EXISTS "Anyone can create reservations" ON public.reservations;

CREATE POLICY "Staff can create reservations" 
ON public.reservations 
FOR INSERT 
TO authenticated
WITH CHECK (is_staff_or_admin(auth.uid()));