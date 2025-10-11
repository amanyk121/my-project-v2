-- Migration: add external_id columns and indexes to asset tables
BEGIN;

ALTER TABLE laptops ADD COLUMN IF NOT EXISTS external_id TEXT;
CREATE INDEX IF NOT EXISTS idx_laptops_external_id ON laptops (external_id);

ALTER TABLE monitors ADD COLUMN IF NOT EXISTS external_id TEXT;
CREATE INDEX IF NOT EXISTS idx_monitors_external_id ON monitors (external_id);

ALTER TABLE printers ADD COLUMN IF NOT EXISTS external_id TEXT;
CREATE INDEX IF NOT EXISTS idx_printers_external_id ON printers (external_id);

ALTER TABLE cameras ADD COLUMN IF NOT EXISTS external_id TEXT;
CREATE INDEX IF NOT EXISTS idx_cameras_external_id ON cameras (external_id);

ALTER TABLE wifi ADD COLUMN IF NOT EXISTS external_id TEXT;
CREATE INDEX IF NOT EXISTS idx_wifi_external_id ON wifi (external_id);

COMMIT;
