-- Adds payment tracking columns to existing booking tables.
-- Run this once if you've already created hotel_bookings / flight_bookings.
-- (If you haven't yet, run the updated hotel_bookings.sql / flight_bookings.sql instead.)

ALTER TABLE hotel_bookings  ADD COLUMN IF NOT EXISTS price                  integer;
ALTER TABLE hotel_bookings  ADD COLUMN IF NOT EXISTS payment_screenshot_url text;

ALTER TABLE flight_bookings ADD COLUMN IF NOT EXISTS price                  integer;
ALTER TABLE flight_bookings ADD COLUMN IF NOT EXISTS payment_screenshot_url text;
