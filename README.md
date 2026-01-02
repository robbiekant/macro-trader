# Macro Trader

An AI-powered macro trading analysis platform that provides personalized investment recommendations based on user risk profiles and real-time market data.

## Features

- **User Authentication** - Secure email/password authentication via Supabase
- **Risk Profile Questionnaire** - Comprehensive assessment of investment experience, goals, and risk tolerance
- **AI-Powered Analysis** - Advanced macroeconomic analysis using Claude AI
- **Portfolio Management** - Track and manage your investment portfolio
- **Real-Time Market Data** - Automated fetching of current market prices and implied volatility
- **Options Strategy Scoring** - Black-Scholes-Merton model for options pricing and strategy evaluation
- **AI Transparency** - Full visibility into AI reasoning and analysis process
- **Historical Analysis** - Access to previous macro analyses and recommendations

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL database + Edge Functions)
- **AI**: Anthropic Claude API
- **Icons**: Lucide React

## Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- Anthropic API key (for AI analysis)

## Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/robbiekant/macro-trader.git
   cd macro-trader
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**

   Create a `.env` file in the root directory:
   ```
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Set up Supabase**

   - Create a new Supabase project
   - Run the migrations in the `supabase/migrations` folder
   - Deploy the edge functions in `supabase/functions`:
     - `ai-macro-analysis` - AI analysis endpoint
     - `fetch-market-data` - Market data fetching endpoint
   - Set the `ANTHROPIC_API_KEY` secret in your Supabase project

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Build for production**
   ```bash
   npm run build
   ```

## Project Structure

```
macro-trader/
├── src/
│   ├── components/          # React components for each page
│   │   ├── AuthPage.tsx
│   │   ├── QuestionnairePage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── PortfolioPage.tsx
│   │   ├── AssetDataPage.tsx
│   │   ├── OptionsStrategyPage.tsx
│   │   ├── RecommendationsPage.tsx
│   │   ├── PreviousAnalysesPage.tsx
│   │   └── AITransparencyPage.tsx
│   ├── lib/
│   │   ├── supabase.ts      # Supabase client
│   │   ├── database.types.ts # Database type definitions
│   │   ├── scoring.ts       # Scoring algorithms
│   │   ├── bsm.ts          # Black-Scholes-Merton model
│   │   └── portfolio.ts     # Portfolio management
│   └── App.tsx              # Main app component
├── supabase/
│   ├── migrations/          # Database migrations
│   └── functions/           # Edge functions
└── package.json
```

## Database Schema

The application uses the following main tables:

- `user_profiles` - User risk profiles and questionnaire responses
- `macro_analyses` - AI-generated macro analyses
- `asset_data` - Real-time asset pricing and volatility data
- `user_portfolios` - User portfolio holdings
- `recommendations` - Investment recommendations
- `asset_scores` - Calculated scores for investment opportunities

## Edge Functions

### ai-macro-analysis
Generates comprehensive macroeconomic analysis using Claude AI based on user risk profile.

### fetch-market-data
Fetches real-time market data for various asset classes including stocks, bonds, commodities, and cryptocurrencies.

## Features in Detail

### Risk Profile Questionnaire
Users answer questions about:
- Investment experience and knowledge
- Financial goals and time horizon
- Risk tolerance and capacity
- Liquidity needs
- Tax considerations

### AI Analysis
Claude AI analyzes:
- Current macroeconomic conditions
- Market sentiment and trends
- Geopolitical factors
- Sector-specific opportunities
- Risk factors and correlations

### Options Strategy Scoring
Uses Black-Scholes-Merton model to evaluate:
- Call and put options
- Covered calls and protective puts
- Spreads and combinations
- Risk-adjusted returns

## Security

- Row Level Security (RLS) enabled on all tables
- User authentication via Supabase Auth
- Secure API key management
- No sensitive data exposed to client

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## Support

For issues or questions, please open an issue on GitHub.
