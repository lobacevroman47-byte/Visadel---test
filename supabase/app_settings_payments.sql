-- Adds payment + booking columns to app_settings (single-row config table).
-- Run once in Supabase SQL editor. Safe to re-run.

ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS payment_card_number    text    DEFAULT '2200 7007 1234 5678';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS payment_card_holder    text    DEFAULT 'IVANOV IVAN';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS hotel_booking_price    integer DEFAULT 2000;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS flight_booking_price   integer DEFAULT 2000;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS hotel_extra_fields     jsonb   DEFAULT '[]'::jsonb;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS flight_extra_fields    jsonb   DEFAULT '[]'::jsonb;

-- Also widen booking tables to keep extra-field answers from forms
ALTER TABLE hotel_bookings  ADD COLUMN IF NOT EXISTS extra_fields jsonb;
ALTER TABLE flight_bookings ADD COLUMN IF NOT EXISTS extra_fields jsonb;
