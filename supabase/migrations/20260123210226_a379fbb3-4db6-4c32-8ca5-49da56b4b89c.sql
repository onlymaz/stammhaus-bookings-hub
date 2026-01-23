-- Add new zone values to the table_zone enum
ALTER TYPE table_zone ADD VALUE IF NOT EXISTS 'room';
ALTER TYPE table_zone ADD VALUE IF NOT EXISTS 'mezz';