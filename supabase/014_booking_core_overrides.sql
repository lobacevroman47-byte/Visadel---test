-- Per-field overrides for the built-in fields of hotel/flight booking forms.
-- Each value is a JSON object keyed by field key, e.g.:
--   {
--     "firstName": { "label": "First Name", "required": true, "visible": true },
--     "children":  { "visible": false }
--   }
-- Empty object {} (default) ⇒ use the form's hardcoded labels/visibility.

ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS hotel_core_overrides   jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS flight_core_overrides  jsonb NOT NULL DEFAULT '{}'::jsonb;
