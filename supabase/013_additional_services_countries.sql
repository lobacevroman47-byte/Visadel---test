-- Per-country availability for additional services.
--
-- Empty array '{}' means "available for ALL countries" (default — backwards compatible).
-- A non-empty array restricts the addon to those exact country names.
--
-- Run once in Supabase SQL editor.

ALTER TABLE additional_services
  ADD COLUMN IF NOT EXISTS countries text[] NOT NULL DEFAULT '{}';
