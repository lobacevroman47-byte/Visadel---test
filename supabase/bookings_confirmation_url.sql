-- Adds confirmation file URL columns so admin can upload the ready hotel/flight
-- booking confirmation, and the user can download it from their cabinet.
-- Also adds a review_bonus_granted flag so we don't double-pay the +200₽ review bonus.

ALTER TABLE hotel_bookings
  ADD COLUMN IF NOT EXISTS confirmation_url       text,
  ADD COLUMN IF NOT EXISTS review_bonus_granted   boolean NOT NULL DEFAULT false;

ALTER TABLE flight_bookings
  ADD COLUMN IF NOT EXISTS confirmation_url       text,
  ADD COLUMN IF NOT EXISTS review_bonus_granted   boolean NOT NULL DEFAULT false;
