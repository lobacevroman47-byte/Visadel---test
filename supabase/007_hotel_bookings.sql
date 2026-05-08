-- Hotel booking requests submitted from the "Брони" tab.
-- Run this once in Supabase SQL editor; the form falls back gracefully if the table is missing.

CREATE TABLE IF NOT EXISTS hotel_bookings (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz   NOT NULL DEFAULT now(),

  -- Who submitted (linked to users.telegram_id but no FK so deletes cascade gracefully)
  telegram_id     bigint,
  username        text,

  -- Personal data (Latin, as in passport)
  first_name      text          NOT NULL,
  last_name       text          NOT NULL,

  -- Trip
  country         text          NOT NULL,
  city            text          NOT NULL,
  check_in        date          NOT NULL,
  check_out       date          NOT NULL,
  guests          smallint      NOT NULL DEFAULT 1,
  children_ages   text[]        NOT NULL DEFAULT '{}',

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

CREATE INDEX IF NOT EXISTS idx_hotel_bookings_telegram_id ON hotel_bookings (telegram_id);
CREATE INDEX IF NOT EXISTS idx_hotel_bookings_created_at  ON hotel_bookings (created_at DESC);

-- Allow public anon insert (form submissions). Reads gated to admins via existing pattern.
ALTER TABLE hotel_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_hotel_bookings" ON hotel_bookings;
CREATE POLICY "anon_insert_hotel_bookings" ON hotel_bookings
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);
