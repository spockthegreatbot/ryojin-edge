-- Migration 001: Add closing_odds, opening_odds, and CLV columns to picks table
-- Safe to run multiple times (IF NOT EXISTS)

ALTER TABLE picks ADD COLUMN IF NOT EXISTS opening_odds FLOAT;
ALTER TABLE picks ADD COLUMN IF NOT EXISTS closing_odds FLOAT;
ALTER TABLE picks ADD COLUMN IF NOT EXISTS clv FLOAT;
