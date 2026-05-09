-- Add SELECT policies so the admin panel can list bookings and the personal
-- cabinet can pull the user's own bookings. Without these, RLS blocks reads
-- (we previously only added INSERT policies).
--
-- Run once in Supabase SQL editor. Safe to re-run.

DROP POLICY IF EXISTS "select_hotel_bookings" ON hotel_bookings;
CREATE POLICY "select_hotel_bookings" ON hotel_bookings
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "select_flight_bookings" ON flight_bookings;
CREATE POLICY "select_flight_bookings" ON flight_bookings
  FOR SELECT TO anon, authenticated
  USING (true);

-- Admin status updates (move to "in_progress" / "confirmed" / "cancelled").
-- The admin uses the regular anon key (no separate auth role yet), so we
-- gate this with a permissive policy and let the UI control who can call it.
DROP POLICY IF EXISTS "update_hotel_bookings" ON hotel_bookings;
CREATE POLICY "update_hotel_bookings" ON hotel_bookings
  FOR UPDATE TO anon, authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "update_flight_bookings" ON flight_bookings;
CREATE POLICY "update_flight_bookings" ON flight_bookings
  FOR UPDATE TO anon, authenticated
  USING (true) WITH CHECK (true);
