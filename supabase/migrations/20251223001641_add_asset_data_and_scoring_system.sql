/*
  # Asset Data and Point Weighting System

  ## Overview
  This migration adds tables for asset-specific data (spot prices, IV rank) and
  a point weighting system to generate trading signals from macro analysis.

  ## New Tables
  
  ### 1. `asset_data`
  Stores current market data for tradeable assets
  - `id` (uuid, primary key)
  - `snapshot_id` (uuid, references macro_snapshots)
  - `symbol` (text) - Asset symbol (ES, NQ, GC, SI, CL, NG, HG, ZW, MBT)
  - `asset_name` (text) - Full name of the asset
  - `asset_class` (text) - equity_index, commodity, fixed_income
  - `spot_price` (numeric) - Current spot/futures price
  - `iv_rank` (numeric) - Implied volatility rank (0-100)
  - `manual_override` (boolean) - Whether user manually entered data
  - `created_at` (timestamptz)
  
  ### 2. `signal_scores`
  Stores weighted scores from macro analysis to generate trading signals
  - `id` (uuid, primary key)
  - `snapshot_id` (uuid, references macro_snapshots)
  - `asset_class` (text) - Asset class being scored
  - `business_cycle_score` (numeric) - Score from business cycle analysis (-3 to +3)
  - `liquidity_score` (numeric) - Score from liquidity conditions (-3 to +3)
  - `interest_rate_score` (numeric) - Score from interest rate analysis (-3 to +3)
  - `valuation_score` (numeric) - Score from valuation analysis (-3 to +3)
  - `commodity_score` (numeric) - Score from commodity fundamentals (-3 to +3)
  - `total_score` (numeric) - Sum of all weighted scores
  - `signal` (text) - Trading signal: buy, sell, neutral
  - `created_at` (timestamptz)

  ## Point Weighting System
  
  Each macro factor is scored from -3 (very bearish) to +3 (very bullish):
  - Business Cycle: expansion(+2), peak(+1), contraction(-2), trough(-1)
  - Liquidity: abundant(+3), adequate(+1), tight(-2), crisis(-3)
  - Interest Rates: rising/QT(-2), stable(0), falling/QE(+2)
  - Valuations: cheap(+2), fair(0), expensive(-2)
  - Commodities: bullish(+2), neutral(0), bearish(-2)
  
  Total score determines signal:
  - Score >= 5: Buy signal → Sell PUT
  - Score <= -5: Sell signal → Sell CALL
  - Score between -5 and 5: Neutral → Sell STRANGLE

  ## Security
  - Enable RLS on all new tables
  - Users can only access their own data
  - Authenticated users required for all operations
*/

-- Create asset_data table
CREATE TABLE IF NOT EXISTS asset_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid REFERENCES macro_snapshots(id) ON DELETE CASCADE NOT NULL,
  symbol text NOT NULL,
  asset_name text NOT NULL,
  asset_class text NOT NULL,
  spot_price numeric DEFAULT 0,
  iv_rank numeric DEFAULT 50,
  manual_override boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create signal_scores table
CREATE TABLE IF NOT EXISTS signal_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid REFERENCES macro_snapshots(id) ON DELETE CASCADE NOT NULL,
  asset_class text NOT NULL,
  business_cycle_score numeric DEFAULT 0,
  liquidity_score numeric DEFAULT 0,
  interest_rate_score numeric DEFAULT 0,
  valuation_score numeric DEFAULT 0,
  commodity_score numeric DEFAULT 0,
  total_score numeric DEFAULT 0,
  signal text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE asset_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_scores ENABLE ROW LEVEL SECURITY;

-- RLS Policies for asset_data
CREATE POLICY "Users can view asset data for their snapshots"
  ON asset_data FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM macro_snapshots
      WHERE macro_snapshots.id = asset_data.snapshot_id
      AND macro_snapshots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert asset data for their snapshots"
  ON asset_data FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM macro_snapshots
      WHERE macro_snapshots.id = asset_data.snapshot_id
      AND macro_snapshots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update asset data for their snapshots"
  ON asset_data FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM macro_snapshots
      WHERE macro_snapshots.id = asset_data.snapshot_id
      AND macro_snapshots.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM macro_snapshots
      WHERE macro_snapshots.id = asset_data.snapshot_id
      AND macro_snapshots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete asset data for their snapshots"
  ON asset_data FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM macro_snapshots
      WHERE macro_snapshots.id = asset_data.snapshot_id
      AND macro_snapshots.user_id = auth.uid()
    )
  );

-- RLS Policies for signal_scores
CREATE POLICY "Users can view signal scores for their snapshots"
  ON signal_scores FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM macro_snapshots
      WHERE macro_snapshots.id = signal_scores.snapshot_id
      AND macro_snapshots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert signal scores for their snapshots"
  ON signal_scores FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM macro_snapshots
      WHERE macro_snapshots.id = signal_scores.snapshot_id
      AND macro_snapshots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update signal scores for their snapshots"
  ON signal_scores FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM macro_snapshots
      WHERE macro_snapshots.id = signal_scores.snapshot_id
      AND macro_snapshots.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM macro_snapshots
      WHERE macro_snapshots.id = signal_scores.snapshot_id
      AND macro_snapshots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete signal scores for their snapshots"
  ON signal_scores FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM macro_snapshots
      WHERE macro_snapshots.id = signal_scores.snapshot_id
      AND macro_snapshots.user_id = auth.uid()
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_asset_data_snapshot_id ON asset_data(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_asset_data_symbol ON asset_data(symbol);
CREATE INDEX IF NOT EXISTS idx_signal_scores_snapshot_id ON signal_scores(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_signal_scores_asset_class ON signal_scores(asset_class);
