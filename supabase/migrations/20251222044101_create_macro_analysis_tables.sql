/*
  # Macro Analysis and Trading Strategy Database Schema

  ## Overview
  This migration creates tables for storing macroeconomic data, AI-generated analysis,
  and options trading strategies based on the Black-Scholes-Merton model.

  ## New Tables
  
  ### 1. `macro_snapshots`
  Stores periodic snapshots of macroeconomic data collected through AI questionnaire
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `created_at` (timestamptz)
  - `business_cycle` (text) - Current phase of business cycle
  - `economic_cycle` (text) - Current economic cycle phase
  - `global_liquidity` (text) - Global liquidity conditions
  - `macro_outlook` (text) - General macro outlook
  - `snapshot_data` (jsonb) - Complete snapshot of all collected data
  
  ### 2. `interest_rates`
  Tracks interest rates and their directions for major countries
  - `id` (uuid, primary key)
  - `snapshot_id` (uuid, references macro_snapshots)
  - `country` (text) - Country name (USA, EU, Japan, China, UK, etc.)
  - `current_rate` (numeric) - Current interest rate
  - `direction` (text) - Direction: rising, falling, stable
  - `policy_stance` (text) - QE, QT, neutral, money printing
  
  ### 3. `market_valuations`
  Stores P/E ratios and valuations for S&P 500 and sectors
  - `id` (uuid, primary key)
  - `snapshot_id` (uuid, references macro_snapshots)
  - `index_name` (text) - S&P 500 or sector name
  - `pe_ratio` (numeric) - Price to earnings ratio
  - `valuation_level` (text) - cheap, fair, expensive
  
  ### 4. `commodity_fundamentals`
  Supply and demand analysis for commodities
  - `id` (uuid, primary key)
  - `snapshot_id` (uuid, references macro_snapshots)
  - `commodity` (text) - gold, silver, natural gas, crude oil, wheat, copper
  - `supply_outlook` (text) - Supply conditions
  - `demand_outlook` (text) - Demand conditions
  - `fundamental_bias` (text) - bullish, bearish, neutral
  
  ### 5. `ai_recommendations`
  AI-generated buy/sell recommendations for asset classes
  - `id` (uuid, primary key)
  - `snapshot_id` (uuid, references macro_snapshots)
  - `asset_class` (text) - Asset class name
  - `recommendation` (text) - buy, sell, hold
  - `conviction_level` (text) - high, medium, low
  - `time_horizon` (text) - Target holding period (default: 6 months)
  - `rationale` (text) - AI reasoning for recommendation
  - `created_at` (timestamptz)
  
  ### 6. `options_strategies`
  Options selling strategies based on BSM model
  - `id` (uuid, primary key)
  - `recommendation_id` (uuid, references ai_recommendations)
  - `asset_class` (text) - Asset class for options
  - `strategy_type` (text) - short_put, short_call, short_strangle
  - `dte` (integer) - Days to expiration (45-60)
  - `spot_price` (numeric) - Current spot price
  - `implied_volatility` (numeric) - IV as decimal (e.g., 0.25 for 25%)
  - `strike_price` (numeric) - Strike price for single leg
  - `strike_price_put` (numeric) - Put strike for strangle
  - `strike_price_call` (numeric) - Call strike for strangle
  - `premium_collected` (numeric) - Total premium from strategy
  - `buying_power_required` (numeric) - Required buying power/margin
  - `manual_input` (boolean) - Whether data was manually entered
  - `created_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Users can only access their own data
  - Authenticated users required for all operations
*/

-- Create macro_snapshots table
CREATE TABLE IF NOT EXISTS macro_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  business_cycle text DEFAULT '',
  economic_cycle text DEFAULT '',
  global_liquidity text DEFAULT '',
  macro_outlook text DEFAULT '',
  snapshot_data jsonb DEFAULT '{}'::jsonb
);

-- Create interest_rates table
CREATE TABLE IF NOT EXISTS interest_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid REFERENCES macro_snapshots(id) ON DELETE CASCADE NOT NULL,
  country text NOT NULL,
  current_rate numeric DEFAULT 0,
  direction text DEFAULT '',
  policy_stance text DEFAULT ''
);

-- Create market_valuations table
CREATE TABLE IF NOT EXISTS market_valuations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid REFERENCES macro_snapshots(id) ON DELETE CASCADE NOT NULL,
  index_name text NOT NULL,
  pe_ratio numeric DEFAULT 0,
  valuation_level text DEFAULT ''
);

-- Create commodity_fundamentals table
CREATE TABLE IF NOT EXISTS commodity_fundamentals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid REFERENCES macro_snapshots(id) ON DELETE CASCADE NOT NULL,
  commodity text NOT NULL,
  supply_outlook text DEFAULT '',
  demand_outlook text DEFAULT '',
  fundamental_bias text DEFAULT ''
);

-- Create ai_recommendations table
CREATE TABLE IF NOT EXISTS ai_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid REFERENCES macro_snapshots(id) ON DELETE CASCADE NOT NULL,
  asset_class text NOT NULL,
  recommendation text DEFAULT '',
  conviction_level text DEFAULT '',
  time_horizon text DEFAULT '6 months',
  rationale text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Create options_strategies table
CREATE TABLE IF NOT EXISTS options_strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id uuid REFERENCES ai_recommendations(id) ON DELETE CASCADE NOT NULL,
  asset_class text NOT NULL,
  strategy_type text NOT NULL,
  dte integer DEFAULT 45,
  spot_price numeric DEFAULT 0,
  implied_volatility numeric DEFAULT 0,
  strike_price numeric DEFAULT 0,
  strike_price_put numeric DEFAULT 0,
  strike_price_call numeric DEFAULT 0,
  premium_collected numeric DEFAULT 0,
  buying_power_required numeric DEFAULT 0,
  manual_input boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE macro_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE interest_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_valuations ENABLE ROW LEVEL SECURITY;
ALTER TABLE commodity_fundamentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE options_strategies ENABLE ROW LEVEL SECURITY;

-- RLS Policies for macro_snapshots
CREATE POLICY "Users can view own macro snapshots"
  ON macro_snapshots FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own macro snapshots"
  ON macro_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own macro snapshots"
  ON macro_snapshots FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own macro snapshots"
  ON macro_snapshots FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for interest_rates
CREATE POLICY "Users can view interest rates for their snapshots"
  ON interest_rates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM macro_snapshots
      WHERE macro_snapshots.id = interest_rates.snapshot_id
      AND macro_snapshots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert interest rates for their snapshots"
  ON interest_rates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM macro_snapshots
      WHERE macro_snapshots.id = interest_rates.snapshot_id
      AND macro_snapshots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update interest rates for their snapshots"
  ON interest_rates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM macro_snapshots
      WHERE macro_snapshots.id = interest_rates.snapshot_id
      AND macro_snapshots.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM macro_snapshots
      WHERE macro_snapshots.id = interest_rates.snapshot_id
      AND macro_snapshots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete interest rates for their snapshots"
  ON interest_rates FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM macro_snapshots
      WHERE macro_snapshots.id = interest_rates.snapshot_id
      AND macro_snapshots.user_id = auth.uid()
    )
  );

-- RLS Policies for market_valuations
CREATE POLICY "Users can view market valuations for their snapshots"
  ON market_valuations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM macro_snapshots
      WHERE macro_snapshots.id = market_valuations.snapshot_id
      AND macro_snapshots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert market valuations for their snapshots"
  ON market_valuations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM macro_snapshots
      WHERE macro_snapshots.id = market_valuations.snapshot_id
      AND macro_snapshots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update market valuations for their snapshots"
  ON market_valuations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM macro_snapshots
      WHERE macro_snapshots.id = market_valuations.snapshot_id
      AND macro_snapshots.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM macro_snapshots
      WHERE macro_snapshots.id = market_valuations.snapshot_id
      AND macro_snapshots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete market valuations for their snapshots"
  ON market_valuations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM macro_snapshots
      WHERE macro_snapshots.id = market_valuations.snapshot_id
      AND macro_snapshots.user_id = auth.uid()
    )
  );

-- RLS Policies for commodity_fundamentals
CREATE POLICY "Users can view commodity fundamentals for their snapshots"
  ON commodity_fundamentals FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM macro_snapshots
      WHERE macro_snapshots.id = commodity_fundamentals.snapshot_id
      AND macro_snapshots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert commodity fundamentals for their snapshots"
  ON commodity_fundamentals FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM macro_snapshots
      WHERE macro_snapshots.id = commodity_fundamentals.snapshot_id
      AND macro_snapshots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update commodity fundamentals for their snapshots"
  ON commodity_fundamentals FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM macro_snapshots
      WHERE macro_snapshots.id = commodity_fundamentals.snapshot_id
      AND macro_snapshots.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM macro_snapshots
      WHERE macro_snapshots.id = commodity_fundamentals.snapshot_id
      AND macro_snapshots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete commodity fundamentals for their snapshots"
  ON commodity_fundamentals FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM macro_snapshots
      WHERE macro_snapshots.id = commodity_fundamentals.snapshot_id
      AND macro_snapshots.user_id = auth.uid()
    )
  );

-- RLS Policies for ai_recommendations
CREATE POLICY "Users can view recommendations for their snapshots"
  ON ai_recommendations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM macro_snapshots
      WHERE macro_snapshots.id = ai_recommendations.snapshot_id
      AND macro_snapshots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert recommendations for their snapshots"
  ON ai_recommendations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM macro_snapshots
      WHERE macro_snapshots.id = ai_recommendations.snapshot_id
      AND macro_snapshots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update recommendations for their snapshots"
  ON ai_recommendations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM macro_snapshots
      WHERE macro_snapshots.id = ai_recommendations.snapshot_id
      AND macro_snapshots.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM macro_snapshots
      WHERE macro_snapshots.id = ai_recommendations.snapshot_id
      AND macro_snapshots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete recommendations for their snapshots"
  ON ai_recommendations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM macro_snapshots
      WHERE macro_snapshots.id = ai_recommendations.snapshot_id
      AND macro_snapshots.user_id = auth.uid()
    )
  );

-- RLS Policies for options_strategies
CREATE POLICY "Users can view options strategies for their recommendations"
  ON options_strategies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ai_recommendations
      JOIN macro_snapshots ON macro_snapshots.id = ai_recommendations.snapshot_id
      WHERE ai_recommendations.id = options_strategies.recommendation_id
      AND macro_snapshots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert options strategies for their recommendations"
  ON options_strategies FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_recommendations
      JOIN macro_snapshots ON macro_snapshots.id = ai_recommendations.snapshot_id
      WHERE ai_recommendations.id = options_strategies.recommendation_id
      AND macro_snapshots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update options strategies for their recommendations"
  ON options_strategies FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ai_recommendations
      JOIN macro_snapshots ON macro_snapshots.id = ai_recommendations.snapshot_id
      WHERE ai_recommendations.id = options_strategies.recommendation_id
      AND macro_snapshots.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_recommendations
      JOIN macro_snapshots ON macro_snapshots.id = ai_recommendations.snapshot_id
      WHERE ai_recommendations.id = options_strategies.recommendation_id
      AND macro_snapshots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete options strategies for their recommendations"
  ON options_strategies FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ai_recommendations
      JOIN macro_snapshots ON macro_snapshots.id = ai_recommendations.snapshot_id
      WHERE ai_recommendations.id = options_strategies.recommendation_id
      AND macro_snapshots.user_id = auth.uid()
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_macro_snapshots_user_id ON macro_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_macro_snapshots_created_at ON macro_snapshots(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interest_rates_snapshot_id ON interest_rates(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_market_valuations_snapshot_id ON market_valuations(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_commodity_fundamentals_snapshot_id ON commodity_fundamentals(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_snapshot_id ON ai_recommendations(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_options_strategies_recommendation_id ON options_strategies(recommendation_id);
