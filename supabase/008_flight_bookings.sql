-- Flight booking requests submitted from the "Брони" tab.
-- Run this once in Supabase SQL editor; the form falls back gracefully if the table is missing.

CREATE TABLE IF NOT EXISTS flight_bookings (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz   NOT NULL DEFAULT now(),

  -- Who submitted
  telegram_id     bigint,
  username        text,

  -- Passenger (Latin, as in passport)
  first_name      text          NOT NULL,
  last_name       text          NOT NULL,

  -- Route
  from_city       text          NOT NULL,
  to_city         text          NOT NULL,
  booking_date    date          NOT NULL,

  -- Contacts (mirrors visa form)
  email           text          NOT NULL,
  phone           text          NOT NULL,
  telegram_login  text          NOT NULL,

  -- Files
  passport_url            text,
  payment_screenshot_url  text,

  -- Pricing
  price                   integer,

  -- Lifecycle
  status                  text          NOT NULL DEFAULT 'new'
);

CREATE INDEX IF NOT EXISTS idx_flight_bookings_telegram_id ON flight_bookings (telegram_id);
CREATE INDEX IF NOT EXISTS idx_flight_bookings_created_at  ON flight_bookings (created_at DESC);

-- Allow public anon insert (form submissions). Reads gated to admins via existing pattern.
ALTER TABLE flight_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_flight_bookings" ON flight_bookings;
CREATE POLICY "anon_insert_flight_bookings" ON flight_bookings
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);
