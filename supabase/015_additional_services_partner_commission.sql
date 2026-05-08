-- Per-service partner commission %, mirrors visa_products.partner_commission_pct.
--
-- A partner referrer (users.is_influencer = true) earns this % of the service price
-- when their referee pays. 0 means we don't pay anything for this service.
-- Default 15% matches the visa default.
--
-- Run once in Supabase SQL editor.

ALTER TABLE additional_services
  ADD COLUMN IF NOT EXISTS partner_commission_pct numeric NOT NULL DEFAULT 15;
