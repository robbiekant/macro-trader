# Macro-Based Options Selling System - Comprehensive Design Document

## Table of Contents
1. [Business Context](#business-context)
2. [Financial Knowledge Foundation](#financial-knowledge-foundation)
3. [Requirements Analysis](#requirements-analysis)
4. [System Architecture](#system-architecture)
5. [Low-Level Design](#low-level-design)
6. [AI Integration & Prompts](#ai-integration--prompts)
7. [Data Flow & Algorithms](#data-flow--algorithms)
8. [Database Schema](#database-schema)

---

## 1. Business Context

### 1.1 Problem Statement
Traditional options trading strategies often rely on technical analysis or single-asset fundamentals, which can miss broader macroeconomic trends that drive multi-asset class behavior. Professional traders and hedge funds use macro-economic indicators to position their portfolios, but retail traders lack accessible tools to implement such strategies.

### 1.2 Target Users
- **Retail Options Traders**: Individuals seeking systematic, macro-driven trading strategies
- **Small Hedge Funds**: Teams needing quantitative macro analysis for options positioning
- **Financial Advisors**: Professionals requiring data-driven portfolio construction tools
- **Quant Researchers**: Analysts studying macro-options strategy relationships

### 1.3 Business Value Proposition
1. **Systematic Decision Making**: Removes emotional bias by using quantifiable macro indicators
2. **Multi-Asset Diversification**: Spreads risk across 9 different asset classes
3. **Premium Income Generation**: Focuses on high-probability option selling strategies
4. **Risk-Adjusted Returns**: Positions sized to maintain controlled notional exposure
5. **Time Efficiency**: Automates complex macro analysis and option pricing calculations

### 1.4 Competitive Advantages
- **Weighted Macro Scoring System**: Proprietary algorithm combining 5 macro factors
- **Options-Specific**: Unlike generic portfolio tools, specifically designed for option sellers
- **Multi-Asset Coverage**: Equity indices, commodities, energy, metals, fixed income
- **AI-Powered Analysis**: GPT-4 integration for nuanced macro interpretation
- **Position Sizing Intelligence**: Automatic lot calculation respecting notional limits

---

## 2. Financial Knowledge Foundation

### 2.1 Macroeconomic Analysis Framework

#### 2.1.1 Business Cycle Theory
**Concept**: The economy moves through four phases: expansion, peak, contraction, recession

**Application in System**:
- **Expansion Phase**: GDP growth > 2%, rising employment → Buy equity indices, sell commodities
- **Peak Phase**: GDP growth slowing, inflation rising → Sell equity indices, buy commodities
- **Contraction Phase**: GDP declining, unemployment rising → Sell equities, buy fixed income
- **Recession Phase**: Negative GDP, high unemployment → Buy fixed income, sell cyclicals

**Scoring Logic**:
```javascript
if (gdpGrowth > 2.5) {
  equityScore += 2;      // Strong growth favors equities
  commodityScore += 1;   // Moderate for commodities
  fixedIncomeScore -= 1; // Negative for bonds
}
```

#### 2.1.2 Liquidity Conditions Theory
**Concept**: Central bank liquidity drives asset prices; "Don't fight the Fed"

**Application in System**:
- **High Liquidity** (M2 growth > 5%): Risk assets rise → Buy equities, sell safe havens
- **Tightening Liquidity** (M2 growth < 3%): Risk assets fall → Sell equities, buy bonds
- **Credit Spreads**: Wide spreads signal stress → De-risk portfolio

**Scoring Logic**:
```javascript
if (m2GrowthRate > 5) {
  equityScore += 2;
  preciousMetalsScore -= 1;
} else if (m2GrowthRate < 2) {
  equityScore -= 1;
  fixedIncomeScore += 2;
}
```

#### 2.1.3 Interest Rate Regime Theory
**Concept**: Interest rates are the price of money and affect all asset valuations

**Application in System**:
- **Rising Rates**: Bonds fall, growth stocks underperform → Sell fixed income, buy value
- **Falling Rates**: Bonds rally, growth stocks outperform → Buy fixed income and tech
- **Real Rates** (Nominal - Inflation): Negative real rates favor gold and commodities

**Scoring Logic**:
```javascript
if (fedFundsRate - inflationRate < 0) {
  // Negative real rates
  preciousMetalsScore += 2;
  commodityScore += 1;
  fixedIncomeScore -= 1;
}
```

#### 2.1.4 Valuation Framework
**Concept**: Asset prices revert to fair value over time; expensive assets underperform

**Application in System**:
- **CAPE Ratio > 30**: Equity markets expensive → Sell equity indices
- **CAPE Ratio < 15**: Equity markets cheap → Buy equity indices
- **Gold/Silver Ratio**: Historical mean reversion indicator

**Scoring Logic**:
```javascript
if (capeRatio > 30) {
  equityScore -= 2;  // Expensive, expect mean reversion
} else if (capeRatio < 15) {
  equityScore += 2;  // Cheap, expect rally
}
```

#### 2.1.5 Commodity Cycle Theory
**Concept**: Commodities move in super-cycles driven by supply/demand imbalances

**Application in System**:
- **High Oil Prices**: Energy stocks rise, consumers hurt → Buy energy, sell consumer
- **Low Oil Prices**: Consumers benefit, energy stressed → Sell energy, buy consumer
- **Supply Disruptions**: Geopolitical events create opportunities

**Scoring Logic**:
```javascript
if (oilPriceChange > 20) {
  energyScore += 2;
  commodityScore += 1;
} else if (oilPriceChange < -20) {
  energyScore -= 2;
}
```

### 2.2 Options Trading Fundamentals

#### 2.2.1 Black-Scholes-Merton Model
**Purpose**: Calculate theoretical option prices

**Formula**:
```
Call Price = S₀N(d₁) - Ke^(-rT)N(d₂)
Put Price = Ke^(-rT)N(-d₂) - S₀N(-d₁)

where:
d₁ = [ln(S₀/K) + (r + σ²/2)T] / (σ√T)
d₂ = d₁ - σ√T

S₀ = Current spot price
K = Strike price
r = Risk-free rate
T = Time to expiration
σ = Implied volatility
N() = Cumulative normal distribution
```

**Application**: Used to price all options in portfolio generation

#### 2.2.2 Implied Volatility (IV)
**Concept**: Market's expectation of future volatility

**IV Rank Formula**:
```
IV Rank = ((Current IV - 52-week Low IV) / (52-week High IV - 52-week Low IV)) × 100
```

**Application**:
- **High IV Rank (>70)**: Sell options (expensive premiums)
- **Low IV Rank (<30)**: Buy options or stay flat
- **System Focus**: Targets high IV environments for premium collection

#### 2.2.3 Option Greeks
**Delta (Δ)**: Rate of price change per $1 move in underlying
- **Short Put Delta ≈ -0.30**: Selected for ~70% probability of profit

**Theta (Θ)**: Time decay, premium collected per day
- **Positive Theta**: Option sellers benefit from time decay

**Vega (ν)**: Sensitivity to IV changes
- **Short Vega**: Profits when IV decreases

#### 2.2.4 Option Selling Strategies

**Strategy 1: Short Put**
```
Strategy: Sell OTM Put
Entry Conditions: Bullish signal, high IV
Strike Selection: 5% below spot (Δ ≈ -0.30)
Risk: Unlimited downside if spot falls below strike
Reward: Premium collected
Max Profit: Premium × Multiplier × Lots
Buying Power: 20% of notional value
```

**Strategy 2: Short Call**
```
Strategy: Sell OTM Call
Entry Conditions: Bearish signal, high IV
Strike Selection: 5% above spot (Δ ≈ 0.30)
Risk: Unlimited upside if spot rises above strike
Reward: Premium collected
Max Profit: Premium × Multiplier × Lots
Buying Power: 20% of notional value
```

**Strategy 3: Short Strangle**
```
Strategy: Sell OTM Put + Sell OTM Call
Entry Conditions: Neutral signal, high IV
Strike Selection: Put 5% below, Call 5% above
Risk: Unlimited on both sides
Reward: Double premium collected
Max Profit: (Put Premium + Call Premium) × Multiplier × Lots
Buying Power: 25% of notional value (higher due to two-sided risk)
```

### 2.3 Position Sizing & Risk Management

#### 2.3.1 Notional Value Calculation
```
Notional Value = Spot Price × Contract Multiplier × Number of Lots

Example (ES - E-mini S&P 500):
Spot Price: $5,800
Multiplier: $50
Max Notional: $450,000

Number of Lots = floor($450,000 / ($5,800 × $50))
              = floor($450,000 / $290,000)
              = 1 lot

Actual Notional = $5,800 × $50 × 1 = $290,000
```

#### 2.3.2 Buying Power Requirements
```
Formula Varies by Strategy:

Short Put/Call:
Buying Power = Spot Price × 0.20 × Multiplier × Lots

Short Strangle:
Buying Power = Spot Price × 0.25 × Multiplier × Lots
(Higher due to two-sided exposure)
```

#### 2.3.3 Return on Capital (ROC)
```
ROC = (Total Premium Collected / Buying Power Required) × 100

Target ROC: 8-15% per cycle (52 days)
Annualized: ~50-100% ROC
```

### 2.4 Futures Contract Specifications

#### ES - E-mini S&P 500
- **Exchange**: CME
- **Contract Size**: $50 × S&P 500 Index
- **Tick Size**: 0.25 points
- **Tick Value**: $12.50
- **Trading Hours**: Nearly 24/5
- **Typical Use**: Equity market exposure

#### NQ - E-mini Nasdaq-100
- **Exchange**: CME
- **Contract Size**: $20 × Nasdaq-100 Index
- **Tick Size**: 0.25 points
- **Tick Value**: $5.00
- **Typical Use**: Technology sector exposure

#### GC - Gold Futures
- **Exchange**: COMEX
- **Contract Size**: 100 troy ounces
- **Tick Size**: $0.10 per ounce
- **Tick Value**: $10.00
- **Typical Use**: Inflation hedge, safe haven

#### SI - Silver Futures
- **Exchange**: COMEX
- **Contract Size**: 5,000 troy ounces
- **Tick Size**: $0.005 per ounce
- **Tick Value**: $25.00
- **Typical Use**: Industrial + precious metal

#### CL - Crude Oil Futures
- **Exchange**: NYMEX
- **Contract Size**: 1,000 barrels
- **Tick Size**: $0.01 per barrel
- **Tick Value**: $10.00
- **Typical Use**: Energy exposure

#### NG - Natural Gas Futures
- **Exchange**: NYMEX
- **Contract Size**: 10,000 MMBtu
- **Tick Size**: $0.001 per MMBtu
- **Tick Value**: $10.00
- **Typical Use**: Energy exposure

#### HG - Copper Futures
- **Exchange**: COMEX
- **Contract Size**: 25,000 pounds
- **Tick Size**: $0.0005 per pound
- **Tick Value**: $12.50
- **Typical Use**: Economic growth indicator

#### ZW - Wheat Futures
- **Exchange**: CBOT
- **Contract Size**: 5,000 bushels
- **Tick Size**: $0.0025 per bushel
- **Tick Value**: $12.50
- **Typical Use**: Agriculture exposure

#### MBT - Micro 10-Year Treasury Note
- **Exchange**: CBOT
- **Contract Size**: $100,000 face value
- **Tick Size**: 0.015625 (1/64 of a point)
- **Tick Value**: $15.625
- **Typical Use**: Interest rate exposure

---

## 3. Requirements Analysis

### 3.1 Functional Requirements

#### FR1: User Authentication
- **FR1.1**: Users must register with email and password
- **FR1.2**: Users must login to access the system
- **FR1.3**: System must maintain session state across pages
- **FR1.4**: Logout functionality must clear all session data

#### FR2: Macro Data Collection
- **FR2.1**: System must collect 10 macro-economic indicators
- **FR2.2**: Users must complete a questionnaire about macro conditions
- **FR2.3**: Each indicator must have user confidence level (1-10)
- **FR2.4**: Data must be saved per analysis snapshot
- **FR2.5**: Users can view and edit previous questionnaires

**Macro Indicators**:
1. GDP Growth Rate (%)
2. Unemployment Rate (%)
3. Inflation Rate (CPI, %)
4. Interest Rate (Federal Funds Rate, %)
5. M2 Money Supply Growth (%)
6. Credit Spread (Baa - 10Y Treasury, bps)
7. Oil Price Change (%, YoY)
8. Stock Market Valuation (CAPE Ratio)
9. Market Sentiment (VIX level)
10. USD Strength Index

#### FR3: AI-Powered Macro Analysis
- **FR3.1**: System must send macro data to GPT-4 for analysis
- **FR3.2**: AI must provide narrative interpretation of conditions
- **FR3.3**: AI analysis must be stored in database
- **FR3.4**: Users can view AI analysis in dashboard
- **FR3.5**: Analysis must be timestamped for historical tracking

#### FR4: Asset Data Management
- **FR4.1**: System must track 9 tradeable futures assets
- **FR4.2**: Each asset must have spot price, IV, and IV Rank
- **FR4.3**: AI button must fetch market data for all assets
- **FR4.4**: Users can manually override AI-fetched data
- **FR4.5**: Data must be validated before saving

**Asset List**:
- ES (E-mini S&P 500)
- NQ (E-mini Nasdaq)
- GC (Gold Futures)
- SI (Silver Futures)
- CL (Crude Oil)
- NG (Natural Gas)
- HG (Copper)
- ZW (Wheat)
- MBT (10-Year Treasury)

#### FR5: Scoring Algorithm
- **FR5.1**: System must calculate weighted scores for 9 asset classes
- **FR5.2**: Scoring must incorporate all 5 macro factors
- **FR5.3**: Each factor must have configurable weights
- **FR5.4**: Scores must generate buy/sell/neutral signals
- **FR5.5**: Signal thresholds: Buy (>2), Sell (<-2), Neutral (-2 to 2)

**Asset Classes Scored**:
1. Equity Indices
2. Precious Metals
3. Energy
4. Industrial Metals
5. Agriculture
6. Fixed Income
7. (Note: Some assets share class scores)

#### FR6: Option Strategy Generation
- **FR6.1**: System must generate strategies for each asset
- **FR6.2**: Strategy selection based on signal: Buy→Short Put, Sell→Short Call, Neutral→Short Strangle
- **FR6.3**: Strikes calculated 5% OTM using Black-Scholes
- **FR6.4**: DTE fixed at 52 days for all options
- **FR6.5**: Premium calculated using BSM model

#### FR7: Position Sizing
- **FR7.1**: Maximum notional per asset: $450,000
- **FR7.2**: Number of lots = floor(MaxNotional / (Spot × Multiplier))
- **FR7.3**: Minimum 1 lot per position
- **FR7.4**: System must calculate total notional exposure
- **FR7.5**: Buying power calculated per strategy type

#### FR8: Portfolio Display
- **FR8.1**: Display comprehensive table with all strategy details
- **FR8.2**: Show: Symbol, Signal, Strategy, Lots, Notional, Strikes, Premium, BP, ROC
- **FR8.3**: Calculate and display totals row
- **FR8.4**: Show portfolio-level metrics (Total Premium, BP, Avg ROC)
- **FR8.5**: Format currency with thousands separators

#### FR9: Historical Analysis Tracking
- **FR9.1**: Users can create multiple analysis snapshots
- **FR9.2**: Each snapshot has unique ID and timestamp
- **FR9.3**: Users can view list of previous analyses
- **FR9.4**: Users can load and review past portfolios
- **FR9.5**: System maintains full historical data

### 3.2 Non-Functional Requirements

#### NFR1: Performance
- **NFR1.1**: Page load time < 2 seconds
- **NFR1.2**: AI analysis response < 30 seconds
- **NFR1.3**: Portfolio generation < 3 seconds
- **NFR1.4**: Database queries < 500ms

#### NFR2: Security
- **NFR2.1**: All passwords hashed using bcrypt
- **NFR2.2**: Row-Level Security (RLS) on all database tables
- **NFR2.3**: User can only access own data
- **NFR2.4**: JWT authentication for API calls
- **NFR2.5**: HTTPS required for all connections

#### NFR3: Scalability
- **NFR3.1**: Support 1,000 concurrent users
- **NFR3.2**: Database can store unlimited snapshots per user
- **NFR3.3**: Edge functions auto-scale with load

#### NFR4: Reliability
- **NFR4.1**: System uptime: 99.5%
- **NFR4.2**: Data persistence guaranteed
- **NFR4.3**: Graceful error handling with user feedback
- **NFR4.4**: Transaction rollback on failures

#### NFR5: Usability
- **NFR5.1**: Intuitive navigation between pages
- **NFR5.2**: Clear error messages
- **NFR5.3**: Responsive design (mobile, tablet, desktop)
- **NFR5.4**: Consistent color scheme and typography
- **NFR5.5**: Loading states for async operations

#### NFR6: Maintainability
- **NFR6.1**: Modular code architecture
- **NFR6.2**: Clear separation of concerns
- **NFR6.3**: Type-safe TypeScript throughout
- **NFR6.4**: Comprehensive inline documentation
- **NFR6.5**: Database migrations versioned and tracked

---

## 4. System Architecture

### 4.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         React SPA (Vite + TypeScript)                │  │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────────┐   │  │
│  │  │  Auth  │ │  Dash  │ │ Question│ │  Portfolio │   │  │
│  │  │  Page  │ │  Page  │ │  Page   │ │    Page    │   │  │
│  │  └────────┘ └────────┘ └────────┘ └────────────┘   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS / WebSocket
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Supabase Platform                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Supabase Auth                            │  │
│  │         (JWT, Session Management)                     │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │          PostgreSQL Database (RLS)                    │  │
│  │  ┌─────────┐ ┌──────────┐ ┌────────────────────┐   │  │
│  │  │macro_   │ │asset_    │ │portfolio_          │   │  │
│  │  │snapshots│ │data      │ │recommendations     │   │  │
│  │  └─────────┘ └──────────┘ └────────────────────┘   │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Edge Functions (Deno)                    │  │
│  │  ┌──────────────────┐  ┌────────────────────────┐  │  │
│  │  │ai-macro-analysis │  │fetch-market-data       │  │  │
│  │  │                  │  │                        │  │  │
│  │  │ - GPT-4 API      │  │ - Market Data APIs    │  │  │
│  │  │ - Macro prompt   │  │ - IV estimation       │  │  │
│  │  └──────────────────┘  └────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ External API Calls
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    External Services                         │
│  ┌──────────────────┐         ┌──────────────────────┐     │
│  │   OpenAI API     │         │  Market Data APIs    │     │
│  │   (GPT-4)        │         │  (Future Integration)│     │
│  └──────────────────┘         └──────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Component Architecture

#### 4.2.1 Frontend Components

```
src/
├── components/
│   ├── AuthPage.tsx           # User login/register
│   ├── DashboardPage.tsx      # Snapshot management
│   ├── QuestionnairePage.tsx  # Macro data collection
│   ├── AssetDataPage.tsx      # Asset price/IV input
│   ├── OptionsStrategyPage.tsx # Strategy configuration
│   ├── RecommendationsPage.tsx # AI analysis display
│   ├── PortfolioPage.tsx      # Final portfolio table
│   └── PreviousAnalysesPage.tsx # Historical view
├── lib/
│   ├── supabase.ts            # Database client
│   ├── scoring.ts             # Scoring algorithm
│   ├── portfolio.ts           # Portfolio generation
│   ├── bsm.ts                 # Black-Scholes model
│   └── database.types.ts      # TypeScript types
├── App.tsx                     # Main app router
└── main.tsx                    # Entry point
```

#### 4.2.2 Backend Components

```
supabase/
├── migrations/
│   ├── 20251222044101_create_macro_analysis_tables.sql
│   ├── 20251223001641_add_asset_data_and_scoring_system.sql
│   └── 20251223003326_add_iv_column_to_asset_data.sql
└── functions/
    ├── ai-macro-analysis/
    │   └── index.ts           # GPT-4 analysis
    └── fetch-market-data/
        └── index.ts           # Market data fetcher
```

### 4.3 Data Flow Diagram

```
User Login
    │
    ▼
Dashboard (List Snapshots)
    │
    ├─── Create New Snapshot ─────────┐
    │                                  │
    │                                  ▼
    │                          Questionnaire Page
    │                                  │
    │                                  │ (Collect 10 macro indicators)
    │                                  │
    │                                  ▼
    │                          Save to macro_snapshots table
    │                                  │
    │                                  ▼
    │                          AI Analysis (Edge Function)
    │                                  │
    │                                  │ (GPT-4 analysis)
    │                                  │
    │                                  ▼
    │                          Save AI response to DB
    │                                  │
    │                                  ▼
    │                          Asset Data Page
    │                                  │
    │                                  │ (Fetch AI data or manual input)
    │                                  │
    │                                  ▼
    │                          Save to asset_data table
    │                                  │
    │                                  ▼
    │                          Portfolio Generation
    │                                  │
    │                                  │ (Calculate scores)
    │                                  │ (Generate strategies)
    │                                  │ (Size positions)
    │                                  │
    │                                  ▼
    │                          Save to portfolio_recommendations
    │                                  │
    │                                  ▼
    │                          Display Portfolio Table
    │                                  │
    └──────────────────────────────────┘
                                       │
                                       ▼
                           User views/analyzes results
```

---

## 5. Low-Level Design

### 5.1 Database Schema Design

#### 5.1.1 macro_snapshots Table

```sql
CREATE TABLE macro_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  created_at timestamptz DEFAULT now(),

  -- Economic Indicators
  gdp_growth_rate numeric NOT NULL,
  unemployment_rate numeric NOT NULL,
  inflation_rate numeric NOT NULL,
  interest_rate numeric NOT NULL,
  m2_growth_rate numeric NOT NULL,
  credit_spread numeric NOT NULL,
  oil_price_change numeric NOT NULL,
  cape_ratio numeric NOT NULL,
  vix_level numeric NOT NULL,
  usd_strength_index numeric NOT NULL,

  -- Confidence Levels (1-10)
  gdp_confidence integer CHECK (gdp_confidence BETWEEN 1 AND 10),
  unemployment_confidence integer CHECK (unemployment_confidence BETWEEN 1 AND 10),
  inflation_confidence integer CHECK (inflation_confidence BETWEEN 1 AND 10),
  interest_confidence integer CHECK (interest_confidence BETWEEN 1 AND 10),
  m2_confidence integer CHECK (m2_confidence BETWEEN 1 AND 10),
  credit_spread_confidence integer CHECK (credit_spread_confidence BETWEEN 1 AND 10),
  oil_confidence integer CHECK (oil_confidence BETWEEN 1 AND 10),
  cape_confidence integer CHECK (cape_confidence BETWEEN 1 AND 10),
  vix_confidence integer CHECK (vix_confidence BETWEEN 1 AND 10),
  usd_confidence integer CHECK (usd_confidence BETWEEN 1 AND 10),

  -- AI Analysis
  ai_analysis text,
  analysis_completed boolean DEFAULT false,

  -- Status
  snapshot_name text DEFAULT 'Untitled Analysis',
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'complete'))
);

-- Row Level Security
ALTER TABLE macro_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own snapshots"
  ON macro_snapshots FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own snapshots"
  ON macro_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own snapshots"
  ON macro_snapshots FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

**Design Decisions**:
- **UUID Primary Key**: Distributed system friendly, no collisions
- **User ID Foreign Key**: Links to Supabase auth.users table
- **Numeric Types**: Precise decimal storage for financial data
- **Check Constraints**: Enforce confidence levels between 1-10
- **RLS Policies**: Users can only access their own data
- **Timestamptz**: Timezone-aware timestamps for global users
- **Separate Confidence Columns**: Allows weighted scoring in future

#### 5.1.2 asset_data Table

```sql
CREATE TABLE asset_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid REFERENCES macro_snapshots(id) ON DELETE CASCADE,

  -- Asset Identification
  symbol text NOT NULL,
  asset_name text NOT NULL,
  asset_class text NOT NULL,

  -- Market Data
  spot_price numeric NOT NULL CHECK (spot_price > 0),
  implied_volatility numeric DEFAULT 0.25 CHECK (implied_volatility > 0 AND implied_volatility <= 2),
  iv_rank numeric NOT NULL CHECK (iv_rank >= 0 AND iv_rank <= 100),

  -- Metadata
  manual_override boolean DEFAULT false,
  data_source text DEFAULT 'user_input',
  created_at timestamptz DEFAULT now(),

  -- Uniqueness
  UNIQUE(snapshot_id, symbol)
);

-- Row Level Security
ALTER TABLE asset_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view asset data for own snapshots"
  ON asset_data FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM macro_snapshots
      WHERE macro_snapshots.id = asset_data.snapshot_id
      AND macro_snapshots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert asset data for own snapshots"
  ON asset_data FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM macro_snapshots
      WHERE macro_snapshots.id = asset_data.snapshot_id
      AND macro_snapshots.user_id = auth.uid()
    )
  );
```

**Design Decisions**:
- **Cascade Delete**: If snapshot deleted, remove associated asset data
- **Unique Constraint**: One entry per asset per snapshot
- **Check Constraints**: Validate IV between 0-2, IV Rank 0-100
- **RLS via Join**: Security policy checks ownership through snapshot
- **Manual Override Flag**: Tracks if user modified AI-fetched data

#### 5.1.3 portfolio_recommendations Table

```sql
CREATE TABLE portfolio_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid REFERENCES macro_snapshots(id) ON DELETE CASCADE,

  -- Asset Details
  symbol text NOT NULL,
  asset_name text NOT NULL,
  asset_class text NOT NULL,

  -- Trading Signal
  signal text NOT NULL CHECK (signal IN ('buy', 'sell', 'neutral')),
  strategy_type text NOT NULL CHECK (
    strategy_type IN ('short_put', 'short_call', 'short_strangle')
  ),

  -- Position Sizing
  number_of_lots integer NOT NULL CHECK (number_of_lots > 0),
  notional_value numeric NOT NULL,

  -- Option Details
  dte integer DEFAULT 52,
  spot_price numeric NOT NULL,
  implied_volatility numeric NOT NULL,
  strike_price_put numeric,
  strike_price_call numeric,
  premium_put numeric,
  premium_call numeric,

  -- Financial Metrics
  premium_per_contract numeric NOT NULL,
  total_premium numeric NOT NULL,
  buying_power_required numeric NOT NULL,
  return_on_capital numeric NOT NULL,

  created_at timestamptz DEFAULT now(),

  UNIQUE(snapshot_id, symbol)
);

-- Row Level Security
ALTER TABLE portfolio_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view recommendations for own snapshots"
  ON portfolio_recommendations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM macro_snapshots
      WHERE macro_snapshots.id = portfolio_recommendations.snapshot_id
      AND macro_snapshots.user_id = auth.uid()
    )
  );
```

**Design Decisions**:
- **Denormalized Data**: Stores all calculation results for historical accuracy
- **Check Constraints**: Validate enum values for signal and strategy
- **Optional Strikes**: NULL if strategy doesn't use that leg
- **Calculated Fields Stored**: Total premium, ROC stored for historical consistency

### 5.2 Algorithm Design

#### 5.2.1 Macro Scoring Algorithm

**File**: `src/lib/scoring.ts`

**Function**: `calculateAssetClassScores(macroData: MacroData): AssetClassScore[]`

**Input Structure**:
```typescript
interface MacroData {
  gdpGrowthRate: number;        // -5 to 10 (%)
  unemploymentRate: number;     // 0 to 20 (%)
  inflationRate: number;        // -2 to 15 (%)
  interestRate: number;         // 0 to 10 (%)
  m2GrowthRate: number;         // -10 to 30 (%)
  creditSpread: number;         // 50 to 1000 (bps)
  oilPriceChange: number;       // -80 to 200 (%)
  capeRatio: number;            // 5 to 50
  vixLevel: number;             // 10 to 80
  usdStrengthIndex: number;     // 50 to 150
}
```

**Output Structure**:
```typescript
interface AssetClassScore {
  assetClass: string;
  businessCycleScore: number;   // -3 to +3
  liquidityScore: number;       // -3 to +3
  interestRateScore: number;    // -3 to +3
  valuationScore: number;       // -3 to +3
  commodityScore: number;       // -3 to +3
  totalScore: number;           // -15 to +15
  signal: 'buy' | 'sell' | 'neutral';
}
```

**Algorithm Pseudocode**:
```
FOR EACH asset_class IN [Equity Indices, Precious Metals, Energy, ...]

  // Factor 1: Business Cycle Score
  business_cycle_score = 0
  IF gdp_growth > 2.5 THEN
    IF asset_class == 'Equity Indices' THEN business_cycle_score += 2
    IF asset_class == 'Fixed Income' THEN business_cycle_score -= 1
  ELSE IF gdp_growth < 0 THEN
    IF asset_class == 'Equity Indices' THEN business_cycle_score -= 2
    IF asset_class == 'Fixed Income' THEN business_cycle_score += 2

  IF unemployment_rate > 7 THEN
    IF asset_class == 'Equity Indices' THEN business_cycle_score -= 1

  // Factor 2: Liquidity Score
  liquidity_score = 0
  IF m2_growth > 5 THEN
    IF asset_class == 'Equity Indices' THEN liquidity_score += 2
    IF asset_class == 'Precious Metals' THEN liquidity_score -= 1

  IF credit_spread > 300 THEN
    IF asset_class == 'Equity Indices' THEN liquidity_score -= 2
    IF asset_class == 'Fixed Income' THEN liquidity_score += 1

  // Factor 3: Interest Rate Score
  interest_rate_score = 0
  real_rate = interest_rate - inflation_rate

  IF real_rate < 0 THEN
    IF asset_class == 'Precious Metals' THEN interest_rate_score += 2
    IF asset_class == 'Fixed Income' THEN interest_rate_score -= 1

  IF interest_rate > 5 THEN
    IF asset_class == 'Equity Indices' THEN interest_rate_score -= 1

  // Factor 4: Valuation Score
  valuation_score = 0
  IF cape_ratio > 30 THEN
    IF asset_class == 'Equity Indices' THEN valuation_score -= 2
  ELSE IF cape_ratio < 15 THEN
    IF asset_class == 'Equity Indices' THEN valuation_score += 2

  IF vix_level > 30 THEN
    IF asset_class == 'Equity Indices' THEN valuation_score -= 1

  // Factor 5: Commodity Score
  commodity_score = 0
  IF oil_price_change > 20 THEN
    IF asset_class == 'Energy' THEN commodity_score += 2
  ELSE IF oil_price_change < -20 THEN
    IF asset_class == 'Energy' THEN commodity_score -= 2

  IF usd_strength_index > 110 THEN
    IF asset_class == 'Precious Metals' THEN commodity_score -= 1

  // Aggregate
  total_score = business_cycle_score + liquidity_score +
                interest_rate_score + valuation_score + commodity_score

  // Signal Generation
  IF total_score > 2 THEN
    signal = 'buy'
  ELSE IF total_score < -2 THEN
    signal = 'sell'
  ELSE
    signal = 'neutral'

  RETURN AssetClassScore{
    assetClass,
    businessCycleScore,
    liquidityScore,
    interestRateScore,
    valuationScore,
    commodityScore,
    totalScore,
    signal
  }
```

**Actual Implementation Excerpt**:
```typescript
export function calculateAssetClassScores(macroData: MacroData): AssetClassScore[] {
  const scores: Record<string, AssetClassScore> = {};

  ASSET_CLASSES.forEach(assetClass => {
    let businessCycleScore = 0;
    let liquidityScore = 0;
    let interestRateScore = 0;
    let valuationScore = 0;
    let commodityScore = 0;

    // Business Cycle Factor
    if (macroData.gdpGrowthRate > 2.5) {
      if (assetClass === 'Equity Indices') businessCycleScore += 2;
      if (assetClass === 'Fixed Income') businessCycleScore -= 1;
    } else if (macroData.gdpGrowthRate < 0) {
      if (assetClass === 'Equity Indices') businessCycleScore -= 2;
      if (assetClass === 'Fixed Income') businessCycleScore += 2;
    }

    // ... (additional scoring logic)

    const totalScore = businessCycleScore + liquidityScore +
                       interestRateScore + valuationScore + commodityScore;

    const signal = totalScore > 2 ? 'buy' : totalScore < -2 ? 'sell' : 'neutral';

    scores[assetClass] = {
      assetClass,
      businessCycleScore,
      liquidityScore,
      interestRateScore,
      valuationScore,
      commodityScore,
      totalScore,
      signal,
    };
  });

  return Object.values(scores);
}
```

#### 5.2.2 Black-Scholes-Merton Implementation

**File**: `src/lib/bsm.ts`

**Function**: `calculateOptionPrice(...): number`

**Mathematical Implementation**:

```typescript
function normalCDF(x: number): number {
  // Cumulative distribution function for standard normal distribution
  const a1 = 0.31938153;
  const a2 = -0.356563782;
  const a3 = 1.781477937;
  const a4 = -1.821255978;
  const a5 = 1.330274429;

  const L = Math.abs(x);
  const K = 1.0 / (1.0 + 0.2316419 * L);

  const w = 1.0 - 1.0 / Math.sqrt(2 * Math.PI) * Math.exp(-L * L / 2) *
            (a1 * K + a2 * K * K + a3 * Math.pow(K, 3) +
             a4 * Math.pow(K, 4) + a5 * Math.pow(K, 5));

  return x < 0 ? 1.0 - w : w;
}

export function calculateOptionPrice(
  spotPrice: number,      // S₀
  strikePrice: number,    // K
  timeToExpiry: number,   // T (in years)
  riskFreeRate: number,   // r
  volatility: number,     // σ
  optionType: 'call' | 'put'
): number {
  // d₁ = [ln(S₀/K) + (r + σ²/2)T] / (σ√T)
  const d1 = (Math.log(spotPrice / strikePrice) +
              (riskFreeRate + 0.5 * volatility * volatility) * timeToExpiry) /
             (volatility * Math.sqrt(timeToExpiry));

  // d₂ = d₁ - σ√T
  const d2 = d1 - volatility * Math.sqrt(timeToExpiry);

  if (optionType === 'call') {
    // Call = S₀N(d₁) - Ke^(-rT)N(d₂)
    const callPrice = spotPrice * normalCDF(d1) -
                      strikePrice * Math.exp(-riskFreeRate * timeToExpiry) * normalCDF(d2);
    return callPrice;
  } else {
    // Put = Ke^(-rT)N(-d₂) - S₀N(-d₁)
    const putPrice = strikePrice * Math.exp(-riskFreeRate * timeToExpiry) * normalCDF(-d2) -
                     spotPrice * normalCDF(-d1);
    return putPrice;
  }
}
```

**Example Calculation**:
```
Input:
  Spot Price (ES): $5,800
  Strike Price (Put): $5,510 (5% OTM)
  Time to Expiry: 52/365 = 0.1425 years
  Risk-Free Rate: 4% = 0.04
  Volatility: 15% = 0.15

Step 1: Calculate d1
  d1 = [ln(5800/5510) + (0.04 + 0.5*0.15²)*0.1425] / (0.15*√0.1425)
  d1 = [ln(1.0527) + (0.04 + 0.01125)*0.1425] / (0.15*0.3775)
  d1 = [0.0513 + 0.0073] / 0.0566
  d1 = 1.035

Step 2: Calculate d2
  d2 = 1.035 - 0.15*√0.1425
  d2 = 1.035 - 0.0566
  d2 = 0.978

Step 3: Calculate Put Price
  Put = 5510*e^(-0.04*0.1425)*N(-0.978) - 5800*N(-1.035)
  Put = 5510*0.9943*0.164 - 5800*0.150
  Put = 899.3 - 870
  Put = $29.30

Premium per Contract = $29.30 * $50 = $1,465
```

#### 5.2.3 Position Sizing Algorithm

**File**: `src/lib/portfolio.ts`

**Function**: `calculateNumberOfLots(spotPrice, multiplier, maxNotional): number`

**Logic**:
```typescript
function calculateNumberOfLots(
  spotPrice: number,
  multiplier: number,
  maxNotional: number
): number {
  // Notional per contract = Spot × Multiplier
  const notionalPerContract = spotPrice * multiplier;

  // Maximum lots = floor(Max Notional / Notional per Contract)
  const maxLots = Math.floor(maxNotional / notionalPerContract);

  // Minimum 1 lot
  return Math.max(1, maxLots);
}
```

**Example Calculations**:

**Case 1: ES (E-mini S&P 500)**
```
Spot: $5,800
Multiplier: $50
Max Notional: $450,000

Notional per Contract = $5,800 × $50 = $290,000
Max Lots = floor($450,000 / $290,000) = floor(1.55) = 1 lot
Actual Notional = $290,000
```

**Case 2: GC (Gold Futures)**
```
Spot: $2,650
Multiplier: 100 oz
Max Notional: $450,000

Notional per Contract = $2,650 × 100 = $265,000
Max Lots = floor($450,000 / $265,000) = floor(1.70) = 1 lot
Actual Notional = $265,000
```

**Case 3: NG (Natural Gas)**
```
Spot: $3.50
Multiplier: 10,000 MMBtu
Max Notional: $450,000

Notional per Contract = $3.50 × 10,000 = $35,000
Max Lots = floor($450,000 / $35,000) = floor(12.86) = 12 lots
Actual Notional = $420,000
```

#### 5.2.4 Portfolio Generation Algorithm

**File**: `src/lib/portfolio.ts`

**Function**: `generatePortfolio(assetDataList, scores): OptionStrategy[]`

**High-Level Flow**:
```
1. FOR EACH asset IN assetDataList:
   a. Find corresponding score from scores array
   b. Determine strategy type based on signal
   c. Calculate number of lots
   d. Calculate strike prices (5% OTM)
   e. Calculate option premiums using BSM
   f. Calculate total premium and buying power
   g. Calculate ROC
   h. Create OptionStrategy object

2. RETURN array of OptionStrategy objects
```

**Detailed Logic**:
```typescript
export function generatePortfolio(
  assetDataList: AssetData[],
  scores: AssetClassScore[]
): OptionStrategy[] {
  const portfolio: OptionStrategy[] = [];

  assetDataList.forEach(assetData => {
    // Step 1: Find score for this asset's class
    const score = scores.find(s => s.assetClass === assetData.assetClass);
    if (!score) return;

    // Step 2: Get asset specifications
    const asset = TRADEABLE_ASSETS.find(a => a.symbol === assetData.symbol);
    if (!asset) return;

    // Step 3: Determine strategy
    const strategyType = getStrategyType(score.signal);
    // buy → short_put, sell → short_call, neutral → short_strangle

    // Step 4: Calculate position size
    const numberOfLots = calculateNumberOfLots(
      assetData.spotPrice,
      asset.multiplier,
      asset.maxNotional
    );
    const notionalValue = assetData.spotPrice * asset.multiplier * numberOfLots;

    // Step 5: Calculate strikes and premiums
    const timeToExpiry = 52 / 365; // DTE in years
    let premiumPerContract = 0;
    let strikePricePut, strikePriceCall, premiumPut, premiumCall;

    if (strategyType === 'short_put') {
      strikePricePut = assetData.spotPrice * 0.95; // 5% OTM
      premiumPut = calculateOptionPrice(
        assetData.spotPrice,
        strikePricePut,
        timeToExpiry,
        0.04, // Risk-free rate
        assetData.impliedVolatility,
        'put'
      );
      premiumPerContract = premiumPut * asset.multiplier;
    } else if (strategyType === 'short_call') {
      strikePriceCall = assetData.spotPrice * 1.05; // 5% OTM
      premiumCall = calculateOptionPrice(
        assetData.spotPrice,
        strikePriceCall,
        timeToExpiry,
        0.04,
        assetData.impliedVolatility,
        'call'
      );
      premiumPerContract = premiumCall * asset.multiplier;
    } else { // short_strangle
      strikePricePut = assetData.spotPrice * 0.95;
      strikePriceCall = assetData.spotPrice * 1.05;

      premiumPut = calculateOptionPrice(/*...*/);
      premiumCall = calculateOptionPrice(/*...*/);

      premiumPerContract = (premiumPut + premiumCall) * asset.multiplier;
    }

    // Step 6: Calculate financial metrics
    const totalPremium = premiumPerContract * numberOfLots;
    const buyingPowerRequired = calculateBuyingPower(
      assetData.spotPrice,
      strategyType,
      asset.multiplier,
      numberOfLots
    );
    const returnOnCapital = (totalPremium / buyingPowerRequired) * 100;

    // Step 7: Create strategy object
    portfolio.push({
      symbol: assetData.symbol,
      assetName: asset.name,
      assetClass: assetData.assetClass,
      signal: score.signal,
      strategyType,
      numberOfLots,
      notionalValue,
      dte: 52,
      spotPrice: assetData.spotPrice,
      iv: assetData.impliedVolatility,
      strikePricePut,
      strikePriceCall,
      premiumPut: premiumPut ? premiumPut * asset.multiplier * numberOfLots : undefined,
      premiumCall: premiumCall ? premiumCall * asset.multiplier * numberOfLots : undefined,
      premiumPerContract,
      totalPremium,
      buyingPowerRequired,
      returnOnCapital,
    });
  });

  return portfolio;
}
```

### 5.3 Edge Functions Design

#### 5.3.1 AI Macro Analysis Function

**File**: `supabase/functions/ai-macro-analysis/index.ts`

**Purpose**: Sends macro data to GPT-4 for narrative analysis

**API Endpoint**: `POST /functions/v1/ai-macro-analysis`

**Request Body**:
```typescript
{
  snapshotId: string,  // UUID of macro snapshot
  macroData: {
    gdpGrowthRate: number,
    unemploymentRate: number,
    inflationRate: number,
    interestRate: number,
    m2GrowthRate: number,
    creditSpread: number,
    oilPriceChange: number,
    capeRatio: number,
    vixLevel: number,
    usdStrengthIndex: number
  }
}
```

**Response**:
```typescript
{
  success: boolean,
  analysis?: string,  // AI-generated text
  error?: string
}
```

**Implementation Flow**:
```
1. Receive request with macro data
2. Validate authentication (JWT)
3. Construct prompt for GPT-4
4. Call OpenAI API
5. Parse response
6. Update macro_snapshots table with AI analysis
7. Return analysis to client
```

**Error Handling**:
- Invalid JWT → 401 Unauthorized
- Missing OpenAI key → 500 Internal Server Error
- OpenAI API failure → Retry once, then return error
- Database update failure → Log error, return success with warning

#### 5.3.2 Market Data Fetcher Function

**File**: `supabase/functions/fetch-market-data/index.ts`

**Purpose**: Fetches current spot prices and IV for all 9 assets

**API Endpoint**: `POST /functions/v1/fetch-market-data`

**Response**:
```typescript
{
  success: boolean,
  data?: Array<{
    symbol: string,
    name: string,
    spotPrice: number,
    impliedVolatility: number,
    ivRank: number,
    timestamp: string,
    source: string
  }>,
  message?: string,
  error?: string
}
```

**Current Implementation** (Estimated Data):
```typescript
const ASSETS = [
  { symbol: 'ES', name: 'E-mini S&P 500', estimatedSpot: 5800, estimatedIV: 0.15 },
  { symbol: 'NQ', name: 'E-mini Nasdaq', estimatedSpot: 20500, estimatedIV: 0.18 },
  { symbol: 'GC', name: 'Gold Futures', estimatedSpot: 2650, estimatedIV: 0.12 },
  // ... other assets
];
```

**Future Enhancement** (Real Data Integration):
```typescript
// Potential data sources:
// - CME DataMine API for futures prices
// - OptionMetrics for IV data
// - Bloomberg API for professional data
// - Yahoo Finance API for free data

async function fetchRealMarketData(symbol: string) {
  const response = await fetch(`https://api.marketdata.com/futures/${symbol}`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` }
  });
  const data = await response.json();

  return {
    spotPrice: data.lastPrice,
    impliedVolatility: data.impliedVolatility,
    ivRank: data.ivRank
  };
}
```

---

## 6. AI Integration & Prompts

### 6.1 GPT-4 Macro Analysis Prompt

**Location**: `supabase/functions/ai-macro-analysis/index.ts`

**Complete Prompt Structure**:

```typescript
const systemPrompt = `You are a professional macroeconomic analyst specializing in multi-asset portfolio management. Your role is to provide clear, actionable analysis of macroeconomic conditions and their implications for asset class positioning.

Analyze the provided macro data and produce a structured report covering:
1. Current macro regime identification
2. Key drivers and risks
3. Asset class implications
4. Recommended positioning themes`;

const userPrompt = `Analyze the following macroeconomic data and provide investment insights:

## Economic Indicators:
- GDP Growth Rate: ${macroData.gdpGrowthRate}%
- Unemployment Rate: ${macroData.unemploymentRate}%
- Inflation Rate (CPI): ${macroData.inflationRate}%
- Interest Rate (Fed Funds): ${macroData.interestRate}%
- M2 Money Supply Growth: ${macroData.m2GrowthRate}%
- Credit Spread (Baa-10Y): ${macroData.creditSpread} bps
- Oil Price Change (YoY): ${macroData.oilPriceChange}%
- Stock Market Valuation (CAPE): ${macroData.capeRatio}
- Market Volatility (VIX): ${macroData.vixLevel}
- USD Strength Index: ${macroData.usdStrengthIndex}

Please provide a comprehensive analysis structured as follows:

### 1. Macro Regime Assessment
Identify the current macroeconomic regime (e.g., expansion, late-cycle, recession, recovery) based on the data. Explain your reasoning.

### 2. Business Cycle Analysis
Evaluate where we are in the business cycle. Are we in early, mid, or late cycle? What are the key indicators supporting this view?

### 3. Liquidity & Credit Conditions
Assess the liquidity environment. Is the Fed easing or tightening? Are credit conditions supportive or restrictive? What does the credit spread tell us about financial stress?

### 4. Inflation & Interest Rate Outlook
Analyze the inflation dynamics and interest rate environment. Are real rates positive or negative? What are the implications for different asset classes?

### 5. Valuation & Sentiment
Comment on market valuations (CAPE ratio) and sentiment (VIX). Are markets expensive or cheap? Is fear or greed dominating?

### 6. Commodity & Currency Dynamics
Analyze oil price trends and USD strength. What do these tell us about global growth and commodity demand?

### 7. Asset Class Implications

Based on the macro analysis above, provide specific views on:

**Equity Indices (ES, NQ)**:
- Outlook: [Bullish/Bearish/Neutral]
- Rationale: [2-3 sentences]
- Recommended positioning: [Buy/Sell/Neutral]

**Precious Metals (GC, SI)**:
- Outlook: [Bullish/Bearish/Neutral]
- Rationale: [2-3 sentences]
- Recommended positioning: [Buy/Sell/Neutral]

**Energy (CL, NG)**:
- Outlook: [Bullish/Bearish/Neutral]
- Rationale: [2-3 sentences]
- Recommended positioning: [Buy/Sell/Neutral]

**Industrial Metals (HG)**:
- Outlook: [Bullish/Bearish/Neutral]
- Rationale: [2-3 sentences]
- Recommended positioning: [Buy/Sell/Neutral]

**Agriculture (ZW)**:
- Outlook: [Bullish/Bearish/Neutral]
- Rationale: [2-3 sentences]
- Recommended positioning: [Buy/Sell/Neutral]

**Fixed Income (MBT)**:
- Outlook: [Bullish/Bearish/Neutral]
- Rationale: [2-3 sentences]
- Recommended positioning: [Buy/Sell/Neutral]

### 8. Key Risks & Considerations
Identify the top 3 risks to your base case scenario. What could invalidate your analysis?

### 9. Portfolio Positioning Summary
Provide a concise summary of recommended portfolio positioning across all asset classes. Which assets should be overweight, underweight, or neutral?

Keep the analysis professional but accessible. Focus on actionable insights for options selling strategies.`;
```

**Prompt Engineering Rationale**:

1. **System Prompt Design**:
   - **Role Definition**: Establishes GPT-4 as a "professional macroeconomic analyst" to prime for expert-level analysis
   - **Domain Specificity**: "multi-asset portfolio management" focuses on our use case
   - **Output Structure**: Requests "structured report" for consistent, parseable responses
   - **Actionability**: Emphasizes "clear, actionable analysis" to avoid generic commentary

2. **User Prompt Structure**:
   - **Data Presentation**: Clean, labeled format for easy interpretation
   - **Numbered Sections**: Forces comprehensive coverage of all aspects
   - **Specific Questions**: "Where are we in the business cycle?" elicits targeted analysis
   - **Template Responses**: "[Bullish/Bearish/Neutral]" guides AI to our format
   - **Rationale Requirements**: "2-3 sentences" prevents overly verbose or sparse responses

3. **Asset Class Section**:
   - **Explicit Coverage**: Lists all 9 assets/classes to ensure none are missed
   - **Consistent Format**: Same structure for each asset aids parsing and display
   - **Justification Requirement**: "Rationale" forces AI to explain reasoning
   - **Action Recommendation**: "Recommended positioning" aligns with our signal system

4. **Risk Analysis Section**:
   - **Contrarian Thinking**: "What could invalidate your analysis?" encourages balanced view
   - **Top 3 Risks**: Limits to most important factors
   - **Scenario Planning**: Helps users understand uncertainty

5. **Summary Section**:
   - **Portfolio-Level View**: Ties individual recommendations into coherent strategy
   - **Weight Guidance**: "Overweight, underweight, neutral" maps to position sizing
   - **Options Focus**: Reminds AI of our specific use case

**Example AI Response** (Truncated):

```
### 1. Macro Regime Assessment

Based on the provided data, the current macroeconomic regime appears to be **Late-Cycle Expansion** with emerging signs of deceleration. The GDP growth rate of 2.3% indicates moderate economic activity, while the unemployment rate of 4.1% remains near historical lows. However, the elevated CAPE ratio of 31.5 and VIX level of 18.5 suggest growing valuation concerns and increased market uncertainty.

### 2. Business Cycle Analysis

We are in the **late-cycle phase** of the business cycle. Key indicators supporting this view:
- GDP growth has moderated from peak levels but remains positive
- Unemployment is low, but wage pressures are building
- Inflation at 3.2% is above the Fed's 2% target, prompting restrictive policy
- The credit spread of 185 bps is widening from cycle lows, indicating early credit stress

This phase typically precedes either a soft landing or recession, depending on how aggressively the Fed tightens.

### 7. Asset Class Implications

**Equity Indices (ES, NQ)**:
- Outlook: **Neutral to Bearish**
- Rationale: Late-cycle dynamics, elevated valuations (CAPE 31.5), and rising rates create headwinds. However, economic growth remains positive, preventing outright bearish positioning. The high VIX suggests option selling opportunities due to elevated premium.
- Recommended positioning: **Sell** (via short calls or short strangles)

**Precious Metals (GC, SI)**:
- Outlook: **Bullish**
- Rationale: Real interest rates (4.5% - 3.2% = 1.3%) are moderately positive but trending lower as inflation persists. The USD strength index of 102 is high but stabilizing. If the Fed pivots dovish, gold becomes highly attractive.
- Recommended positioning: **Buy** (via short puts)

[... continued for all asset classes ...]

### 9. Portfolio Positioning Summary

**Recommended Positioning**:
- **Underweight**: Equity Indices (sell calls/strangles to collect premium in elevated IV environment)
- **Overweight**: Precious Metals (short puts to gain long exposure with premium collection)
- **Neutral**: Energy (short strangles to profit from range-bound behavior)
- **Neutral**: Fixed Income (wait for clearer Fed signals)

**Key Theme**: Focus on premium collection strategies across all assets given elevated VIX. Position for late-cycle rotation into defensive assets.
```

### 6.2 Prompt Success Factors

**What Makes This Prompt Effective**:

1. **Comprehensive Data Input**: All 10 macro indicators provided with units
2. **Structured Output**: Numbered sections with subsections
3. **Asset-Specific**: Forces analysis of each asset individually
4. **Actionable Format**: Buy/Sell/Neutral recommendations map directly to our signals
5. **Professional Tone**: Produces institutional-quality analysis
6. **Reasoning Required**: AI must justify each recommendation
7. **Risk-Aware**: Explicitly asks for risks and invalidation scenarios
8. **Context-Aware**: Mentions "options selling strategies" to align with our use case

**Potential Improvements**:

1. **Add Examples**: Include sample analysis in system prompt for few-shot learning
2. **Confidence Levels**: Ask AI to rate confidence (1-10) for each recommendation
3. **Quantitative Metrics**: Request specific price levels or ranges
4. **Time Horizons**: Specify short-term (52 days) vs. long-term outlook
5. **Correlation Analysis**: Ask about inter-asset relationships
6. **Historical Context**: Request comparison to similar past periods

---

## 7. Data Flow & Algorithms

### 7.1 Complete User Journey

**Step-by-Step Flow with Data Transformation**:

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: User Login                                              │
├─────────────────────────────────────────────────────────────────┤
│ Input: email, password                                          │
│ Process: Supabase Auth validates credentials                    │
│ Output: JWT token, user_id                                      │
│ Storage: Session stored in localStorage                         │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: Dashboard - View Snapshots                             │
├─────────────────────────────────────────────────────────────────┤
│ Query: SELECT * FROM macro_snapshots WHERE user_id = ?         │
│ Process: Fetch all user's analysis snapshots                   │
│ Output: Array<{id, created_at, snapshot_name, status}>         │
│ Display: List of snapshots with create/view options            │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼ (Click "New Analysis")
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: Create Snapshot                                        │
├─────────────────────────────────────────────────────────────────┤
│ Input: User clicks "Start New Analysis"                        │
│ Query: INSERT INTO macro_snapshots (user_id, status)           │
│        VALUES (?, 'draft') RETURNING id                         │
│ Output: snapshot_id (UUID)                                      │
│ Navigation: → Questionnaire Page                               │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: Questionnaire - Collect Macro Data                     │
├─────────────────────────────────────────────────────────────────┤
│ Input: User enters 10 indicators + confidence levels           │
│   Example:                                                      │
│   - gdpGrowthRate: 2.3                                         │
│   - gdp_confidence: 8                                          │
│   - unemploymentRate: 4.1                                      │
│   - unemployment_confidence: 9                                 │
│   ... (18 more fields)                                         │
│                                                                 │
│ Validation:                                                     │
│   - All fields required                                        │
│   - Confidence: 1-10                                           │
│   - GDP: -5 to 10                                              │
│   - Unemployment: 0 to 20                                      │
│   ... (range checks for each)                                  │
│                                                                 │
│ Query: UPDATE macro_snapshots SET                              │
│        gdp_growth_rate = ?, gdp_confidence = ?, ...            │
│        WHERE id = ? AND user_id = ?                            │
│                                                                 │
│ Output: Snapshot saved to database                             │
│ Navigation: → AI Analysis trigger                              │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 5: AI Macro Analysis (Edge Function)                      │
├─────────────────────────────────────────────────────────────────┤
│ Trigger: Automatic after questionnaire save                    │
│                                                                 │
│ Request to Edge Function:                                      │
│   POST /functions/v1/ai-macro-analysis                         │
│   Body: {                                                       │
│     snapshotId: "uuid",                                        │
│     macroData: {                                               │
│       gdpGrowthRate: 2.3,                                      │
│       unemploymentRate: 4.1,                                   │
│       ... (all 10 indicators)                                  │
│     }                                                           │
│   }                                                             │
│   Headers: {                                                    │
│     Authorization: "Bearer <jwt_token>"                        │
│   }                                                             │
│                                                                 │
│ Edge Function Process:                                         │
│   1. Validate JWT                                              │
│   2. Construct GPT-4 prompt (see section 6.1)                 │
│   3. Call OpenAI API:                                          │
│      POST https://api.openai.com/v1/chat/completions          │
│      {                                                          │
│        model: "gpt-4",                                         │
│        messages: [                                             │
│          {role: "system", content: systemPrompt},             │
│          {role: "user", content: userPrompt}                  │
│        ],                                                       │
│        temperature: 0.7,                                       │
│        max_tokens: 2000                                        │
│      }                                                          │
│   4. Parse AI response                                         │
│   5. Update database:                                          │
│      UPDATE macro_snapshots                                    │
│      SET ai_analysis = ?, analysis_completed = true           │
│      WHERE id = ?                                              │
│                                                                 │
│ Response to Client:                                            │
│   {                                                             │
│     success: true,                                             │
│     analysis: "### 1. Macro Regime Assessment\n..."           │
│   }                                                             │
│                                                                 │
│ Display: Show AI analysis on Recommendations page              │
│ Navigation: → Asset Data Page                                  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 6: Asset Data Input                                       │
├─────────────────────────────────────────────────────────────────┤
│ Option A: Manual Input                                         │
│   User enters for each asset:                                  │
│   - Spot Price: 5800                                           │
│   - Implied Volatility: 0.15                                   │
│   - IV Rank: 52                                                │
│                                                                 │
│ Option B: AI Fetch (Click "Fetch AI Data" button)             │
│   Request to Edge Function:                                    │
│     POST /functions/v1/fetch-market-data                       │
│     Headers: { Authorization: "Bearer <jwt>" }                 │
│                                                                 │
│   Edge Function Returns:                                       │
│     {                                                           │
│       success: true,                                           │
│       data: [                                                   │
│         {                                                       │
│           symbol: "ES",                                        │
│           spotPrice: 5800,                                     │
│           impliedVolatility: 0.15,                            │
│           ivRank: 52                                           │
│         },                                                      │
│         ... (8 more assets)                                    │
│       ]                                                         │
│     }                                                           │
│                                                                 │
│   Client auto-fills all fields                                │
│   User can override any value                                 │
│                                                                 │
│ Validation:                                                     │
│   - Spot Price > 0                                             │
│   - IV: 0.01 to 2.0 (1% to 200%)                              │
│   - IV Rank: 0 to 100                                          │
│                                                                 │
│ Storage:                                                        │
│   DELETE FROM asset_data WHERE snapshot_id = ?                │
│                                                                 │
│   INSERT INTO asset_data (snapshot_id, symbol, asset_name,    │
│     asset_class, spot_price, implied_volatility, iv_rank,     │
│     manual_override) VALUES                                    │
│     (?, 'ES', 'E-mini S&P 500', 'Equity Indices',            │
│      5800, 0.15, 52, true),                                   │
│     (?, 'NQ', 'E-mini Nasdaq', 'Equity Indices',             │
│      20500, 0.18, 48, true),                                  │
│     ... (7 more rows)                                          │
│                                                                 │
│ Output: 9 rows in asset_data table                            │
│ Navigation: → Portfolio Generation                             │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 7: Portfolio Generation (Client-Side)                     │
├─────────────────────────────────────────────────────────────────┤
│ Input Data Fetching:                                           │
│   Query 1: Fetch macro data                                    │
│     SELECT * FROM macro_snapshots WHERE id = ?                 │
│     → macroData object                                         │
│                                                                 │
│   Query 2: Fetch asset data                                    │
│     SELECT * FROM asset_data WHERE snapshot_id = ?            │
│     → assetDataList array                                      │
│                                                                 │
│ Algorithm Execution:                                           │
│                                                                 │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ Sub-Step 7A: Calculate Asset Class Scores                 │ │
│ │                                                            │ │
│ │ Function: calculateAssetClassScores(macroData)           │ │
│ │                                                            │ │
│ │ For Asset Class "Equity Indices":                         │ │
│ │                                                            │ │
│ │   businessCycleScore = 0                                  │ │
│ │   IF gdpGrowthRate (2.3) > 2.5 → +2 = 0 (FALSE)         │ │
│ │   IF gdpGrowthRate < 0 → -2 = 0 (FALSE)                 │ │
│ │   IF unemploymentRate (4.1) > 7 → -1 = 0 (FALSE)        │ │
│ │   Result: businessCycleScore = 0                         │ │
│ │                                                            │ │
│ │   liquidityScore = 0                                      │ │
│ │   IF m2GrowthRate (4.2) > 5 → +2 = 0 (FALSE)            │ │
│ │   IF creditSpread (185) > 300 → -2 = 0 (FALSE)          │ │
│ │   IF creditSpread > 200 → -1 = 0 (FALSE)                │ │
│ │   Result: liquidityScore = 0                             │ │
│ │                                                            │ │
│ │   interestRateScore = 0                                   │ │
│ │   realRate = 4.5 - 3.2 = 1.3 (positive)                 │ │
│ │   IF realRate < 0 → ... (FALSE)                          │ │
│ │   IF interestRate > 5 → -1 = 0 (FALSE)                  │ │
│ │   Result: interestRateScore = 0                          │ │
│ │                                                            │ │
│ │   valuationScore = 0                                      │ │
│ │   IF capeRatio (31.5) > 30 → -2 = -2 (TRUE)            │ │
│ │   Result: valuationScore = -2                            │ │
│ │                                                            │ │
│ │   commodityScore = 0                                      │ │
│ │   Result: commodityScore = 0                             │ │
│ │                                                            │ │
│ │   totalScore = 0 + 0 + 0 + (-2) + 0 = -2                │ │
│ │   signal = totalScore <= -2 ? 'sell' : ... → 'sell'     │ │
│ │                                                            │ │
│ │ Output for Equity Indices:                                │ │
│ │   {                                                        │ │
│ │     assetClass: "Equity Indices",                        │ │
│ │     businessCycleScore: 0,                               │ │
│ │     liquidityScore: 0,                                   │ │
│ │     interestRateScore: 0,                                │ │
│ │     valuationScore: -2,                                  │ │
│ │     commodityScore: 0,                                   │ │
│ │     totalScore: -2,                                      │ │
│ │     signal: 'sell'                                       │ │
│ │   }                                                        │ │
│ │                                                            │ │
│ │ [Repeat for 8 other asset classes...]                    │ │
│ │                                                            │ │
│ │ Final Output: scores array with 9 AssetClassScore objects│ │
│ └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ Sub-Step 7B: Generate Option Strategies                  │ │
│ │                                                            │ │
│ │ Function: generatePortfolio(assetDataList, scores)       │ │
│ │                                                            │ │
│ │ Example for ES (E-mini S&P 500):                         │ │
│ │                                                            │ │
│ │ Input:                                                     │ │
│ │   assetData = {                                          │ │
│ │     symbol: "ES",                                        │ │
│ │     assetClass: "Equity Indices",                       │ │
│ │     spotPrice: 5800,                                     │ │
│ │     impliedVolatility: 0.15,                            │ │
│ │     ivRank: 52                                           │ │
│ │   }                                                        │ │
│ │   score = {                                              │ │
│ │     assetClass: "Equity Indices",                       │ │
│ │     signal: 'sell',                                      │ │
│ │     totalScore: -2                                       │ │
│ │   }                                                        │ │
│ │                                                            │ │
│ │ Step 1: Determine strategy                               │ │
│ │   signal = 'sell' → strategyType = 'short_call'         │ │
│ │                                                            │ │
│ │ Step 2: Calculate position size                          │ │
│ │   spotPrice = 5800                                       │ │
│ │   multiplier = 50                                        │ │
│ │   maxNotional = 450000                                   │ │
│ │   notionalPerContract = 5800 × 50 = 290000             │ │
│ │   numberOfLots = floor(450000 / 290000) = 1            │ │
│ │   actualNotional = 5800 × 50 × 1 = 290000              │ │
│ │                                                            │ │
│ │ Step 3: Calculate strike                                 │ │
│ │   strikePrice = 5800 × 1.05 = 6090 (5% OTM call)       │ │
│ │                                                            │ │
│ │ Step 4: Price option (Black-Scholes)                    │ │
│ │   S = 5800, K = 6090, T = 52/365 = 0.1425              │ │
│ │   r = 0.04, σ = 0.15                                    │ │
│ │                                                            │ │
│ │   d1 = [ln(5800/6090) + (0.04 + 0.5*0.15²)*0.1425]    │ │
│ │        / (0.15*√0.1425)                                 │ │
│ │      = [ln(0.9524) + 0.0069] / 0.0566                  │ │
│ │      = [-0.0488 + 0.0069] / 0.0566                     │ │
│ │      = -0.74                                            │ │
│ │                                                            │ │
│ │   d2 = -0.74 - 0.0566 = -0.797                         │ │
│ │                                                            │ │
│ │   Call = 5800*N(-0.74) - 6090*e^(-0.04*0.1425)*N(-0.797)│ │
│ │        = 5800*0.230 - 6090*0.9943*0.213                │ │
│ │        = 1334 - 1289                                    │ │
│ │        = $45                                             │ │
│ │                                                            │ │
│ │ Step 5: Calculate financials                            │ │
│ │   premiumPerContract = 45 × 50 = $2,250                │ │
│ │   totalPremium = 2250 × 1 = $2,250                     │ │
│ │                                                            │ │
│ │   buyingPower = 5800 × 0.20 × 50 × 1 = $58,000        │ │
│ │   ROC = (2250 / 58000) × 100 = 3.88%                   │ │
│ │                                                            │ │
│ │ Output Strategy Object:                                  │ │
│ │   {                                                        │ │
│ │     symbol: "ES",                                        │ │
│ │     assetName: "E-mini S&P 500",                        │ │
│ │     assetClass: "Equity Indices",                       │ │
│ │     signal: "sell",                                      │ │
│ │     strategyType: "short_call",                         │ │
│ │     numberOfLots: 1,                                     │ │
│ │     notionalValue: 290000,                              │ │
│ │     dte: 52,                                             │ │
│ │     spotPrice: 5800,                                     │ │
│ │     iv: 0.15,                                            │ │
│ │     strikePricePut: undefined,                          │ │
│ │     strikePriceCall: 6090,                              │ │
│ │     premiumPut: undefined,                              │ │
│ │     premiumCall: 2250,                                   │ │
│ │     premiumPerContract: 2250,                           │ │
│ │     totalPremium: 2250,                                  │ │
│ │     buyingPowerRequired: 58000,                         │ │
│ │     returnOnCapital: 3.88                               │ │
│ │   }                                                        │ │
│ │                                                            │ │
│ │ [Repeat for 8 other assets...]                           │ │
│ │                                                            │ │
│ │ Final Output: portfolio array with 9 OptionStrategy      │ │
│ │               objects                                     │ │
│ └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│ Storage:                                                        │
│   DELETE FROM portfolio_recommendations WHERE snapshot_id = ? │
│                                                                 │
│   INSERT INTO portfolio_recommendations (                      │
│     snapshot_id, symbol, asset_name, asset_class,             │
│     signal, strategy_type, number_of_lots, notional_value,    │
│     dte, spot_price, implied_volatility,                      │
│     strike_price_put, strike_price_call,                      │
│     premium_put, premium_call,                                │
│     premium_per_contract, total_premium,                      │
│     buying_power_required, return_on_capital                  │
│   ) VALUES (?, 'ES', ..., 2250, 58000, 3.88),                │
│            (?, 'NQ', ..., ..., ..., ...),                     │
│            ... (7 more rows)                                  │
│                                                                 │
│ Output: 9 rows in portfolio_recommendations table             │
│ Navigation: → Portfolio Display Page                           │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 8: Portfolio Display                                      │
├─────────────────────────────────────────────────────────────────┤
│ Query: SELECT * FROM portfolio_recommendations                 │
│        WHERE snapshot_id = ?                                    │
│        ORDER BY asset_class, symbol                            │
│                                                                 │
│ Calculate Totals:                                              │
│   totalPremium = SUM(total_premium) = $25,430                 │
│   totalBuyingPower = SUM(buying_power_required) = $387,500   │
│   avgROC = totalPremium / totalBuyingPower × 100 = 6.56%     │
│   numberOfTrades = COUNT(*) = 9                               │
│                                                                 │
│ Display: Comprehensive table with columns:                     │
│   - Symbol                                                     │
│   - Asset Name                                                 │
│   - Signal (with icon)                                        │
│   - Strategy                                                   │
│   - Number of Lots                                            │
│   - Notional Value                                            │
│   - PUT Strike (if applicable)                                │
│   - CALL Strike (if applicable)                               │
│   - Premium per Contract                                      │
│   - Total Premium                                             │
│   - Buying Power Required                                     │
│   - ROC %                                                      │
│                                                                 │
│ Footer Row:                                                    │
│   TOTALS: | | | | | | | | | $25,430 | $387,500 | 6.56%       │
│                                                                 │
│ User Actions:                                                  │
│   - View detailed breakdown                                    │
│   - Export to CSV/PDF (future)                                │
│   - Go back to edit inputs                                    │
│   - Create new analysis                                       │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 State Management

**Client-Side State** (React useState):
```typescript
// App.tsx
const [currentPage, setCurrentPage] = useState<'auth' | 'dashboard' | ...>('auth');
const [user, setUser] = useState<User | null>(null);
const [currentSnapshotId, setCurrentSnapshotId] = useState<string | null>(null);

// Each Page Component
const [loading, setLoading] = useState<boolean>(false);
const [error, setError] = useState<string>('');
const [data, setData] = useState<DataType[]>([]);
```

**Server-Side State** (Supabase Database):
- User authentication state (JWT, session)
- All persistent data (snapshots, assets, portfolios)
- Historical analysis records

**Session State** (localStorage):
```typescript
localStorage.setItem('supabase.auth.token', jwt);
```

---

## 8. Database Schema

### 8.1 Complete ERD

```
┌─────────────────────────────┐
│       auth.users            │ (Managed by Supabase Auth)
│ ─────────────────────────── │
│ PK: id (uuid)               │
│     email (text)            │
│     encrypted_password      │
│     created_at              │
└─────────────────────────────┘
              │ 1
              │
              │ user_id (FK)
              │
              │ *
┌─────────────────────────────────────────────────────────────────┐
│                     macro_snapshots                             │
│ ─────────────────────────────────────────────────────────────── │
│ PK: id (uuid)                                                   │
│ FK: user_id → auth.users(id)                                   │
│     created_at (timestamptz)                                    │
│     snapshot_name (text)                                        │
│     status (text) CHECK IN ('draft', 'complete')               │
│                                                                  │
│     gdp_growth_rate (numeric)                                   │
│     unemployment_rate (numeric)                                 │
│     inflation_rate (numeric)                                    │
│     interest_rate (numeric)                                     │
│     m2_growth_rate (numeric)                                    │
│     credit_spread (numeric)                                     │
│     oil_price_change (numeric)                                  │
│     cape_ratio (numeric)                                        │
│     vix_level (numeric)                                         │
│     usd_strength_index (numeric)                                │
│                                                                  │
│     [10 confidence columns] (integer 1-10)                     │
│                                                                  │
│     ai_analysis (text)                                          │
│     analysis_completed (boolean)                                │
└─────────────────────────────────────────────────────────────────┘
              │ 1
              │
              ├──────────────────────┬─────────────────────────┐
              │                      │                         │
              │ snapshot_id (FK)     │                         │
              │                      │                         │
              │ *                    │ *                       │
┌─────────────────────────────┐  ┌────────────────────────────────────┐
│       asset_data            │  │   portfolio_recommendations        │
│ ─────────────────────────── │  │ ────────────────────────────────── │
│ PK: id (uuid)               │  │ PK: id (uuid)                      │
│ FK: snapshot_id             │  │ FK: snapshot_id                    │
│     → macro_snapshots(id)   │  │     → macro_snapshots(id)          │
│     ON DELETE CASCADE       │  │     ON DELETE CASCADE              │
│                             │  │                                    │
│     symbol (text)           │  │     symbol (text)                  │
│     asset_name (text)       │  │     asset_name (text)              │
│     asset_class (text)      │  │     asset_class (text)             │
│     spot_price (numeric)    │  │     signal (text)                  │
│     implied_volatility      │  │     strategy_type (text)           │
│       (numeric)             │  │     number_of_lots (integer)       │
│     iv_rank (numeric)       │  │     notional_value (numeric)       │
│     manual_override (bool)  │  │     dte (integer)                  │
│     data_source (text)      │  │     spot_price (numeric)           │
│     created_at (timestamptz)│  │     implied_volatility (numeric)   │
│                             │  │     strike_price_put (numeric)     │
│ UNIQUE(snapshot_id, symbol) │  │     strike_price_call (numeric)    │
└─────────────────────────────┘  │     premium_put (numeric)          │
                                 │     premium_call (numeric)         │
                                 │     premium_per_contract (numeric) │
                                 │     total_premium (numeric)        │
                                 │     buying_power_required (numeric)│
                                 │     return_on_capital (numeric)    │
                                 │     created_at (timestamptz)       │
                                 │                                    │
                                 │ UNIQUE(snapshot_id, symbol)        │
                                 └────────────────────────────────────┘
```

### 8.2 Indexes

**Performance Optimization**:

```sql
-- macro_snapshots
CREATE INDEX idx_macro_snapshots_user_created
  ON macro_snapshots(user_id, created_at DESC);

CREATE INDEX idx_macro_snapshots_status
  ON macro_snapshots(user_id, status);

-- asset_data
CREATE INDEX idx_asset_data_snapshot
  ON asset_data(snapshot_id);

-- portfolio_recommendations
CREATE INDEX idx_portfolio_snapshot
  ON portfolio_recommendations(snapshot_id);
```

**Query Patterns**:
- Fetch user's recent snapshots: Uses `idx_macro_snapshots_user_created`
- Fetch asset data for snapshot: Uses `idx_asset_data_snapshot`
- Fetch portfolio for snapshot: Uses `idx_portfolio_snapshot`

---

## Summary

This comprehensive design document covers:

1. **Business Context**: Problem statement, target users, value proposition
2. **Financial Knowledge**: Detailed explanation of macro theories, options pricing, position sizing
3. **Requirements**: Functional and non-functional requirements with acceptance criteria
4. **Architecture**: High-level and component-level system design
5. **Low-Level Design**: Detailed algorithm pseudocode, database schema, data flow
6. **AI Integration**: Complete GPT-4 prompts with rationale and examples
7. **Data Flow**: Step-by-step user journey with data transformations
8. **Database Design**: ERD, RLS policies, indexes, and query patterns

This system combines sophisticated financial modeling with modern cloud architecture to deliver an institutional-quality options trading tool accessible to retail traders.
