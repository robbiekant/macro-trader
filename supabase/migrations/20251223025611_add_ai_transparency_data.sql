/*
  # Add AI Transparency Data

  ## Overview
  This migration adds columns to store AI analysis transparency data including:
  - The complete input data used for generating recommendations
  - The analysis logic/prompt description
  - The final recommendations output

  ## Changes
  1. New Columns in `macro_snapshots` table:
    - `analysis_input_data` (jsonb) - Stores all macro data collected from questionnaire and AI calls
    - `analysis_logic` (text) - Stores description of the logic/rules used to generate recommendations
    - `analysis_output_data` (jsonb) - Stores the final recommendations generated

  ## Notes
  - All fields are nullable since existing records won't have this data
  - Data will be populated when recommendations are generated
*/

-- Add transparency columns to macro_snapshots table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'macro_snapshots' AND column_name = 'analysis_input_data'
  ) THEN
    ALTER TABLE macro_snapshots ADD COLUMN analysis_input_data jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'macro_snapshots' AND column_name = 'analysis_logic'
  ) THEN
    ALTER TABLE macro_snapshots ADD COLUMN analysis_logic text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'macro_snapshots' AND column_name = 'analysis_output_data'
  ) THEN
    ALTER TABLE macro_snapshots ADD COLUMN analysis_output_data jsonb;
  END IF;
END $$;