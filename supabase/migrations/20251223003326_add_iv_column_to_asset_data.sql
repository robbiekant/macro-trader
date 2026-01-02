/*
  # Add IV Column to Asset Data

  ## Overview
  This migration adds an implied_volatility column to the asset_data table
  to store the actual IV percentage alongside the IV rank.

  ## Changes
  
  1. Add Column
    - `implied_volatility` (numeric) - Actual IV as decimal (e.g., 0.25 for 25%)
    - Default to 0.25 (25% IV)
  
  ## Notes
  - IV Rank is percentile (0-100)
  - Implied Volatility is actual volatility (0.0-1.0 typically 0.10-0.50)
*/

-- Add implied_volatility column to asset_data
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'asset_data' AND column_name = 'implied_volatility'
  ) THEN
    ALTER TABLE asset_data ADD COLUMN implied_volatility numeric DEFAULT 0.25;
  END IF;
END $$;
