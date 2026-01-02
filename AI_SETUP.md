# AI Auto-Fill Setup Instructions

The MacroTrader app includes AI-powered auto-fill capabilities that can automatically populate macro economic data for you. This feature uses OpenAI's GPT-4 model to gather current market data.

## Features

The AI Auto-Fill can populate:
1. **General Macro Conditions** - Business cycle, economic cycle, global liquidity, and macro outlook
2. **Interest Rates & Monetary Policy** - Current rates for USA, EU, Japan, China, UK, Canada, and Australia
3. **Market Valuations** - P/E ratios for S&P 500 and all major sectors
4. **Commodity Fundamentals** - Supply/demand analysis for Gold, Silver, Crude Oil, Natural Gas, Wheat, and Copper

## Setup Instructions

To enable the AI auto-fill feature, you need to configure your OpenAI API key:

### Step 1: Get an OpenAI API Key

1. Go to [OpenAI's Platform](https://platform.openai.com/)
2. Sign in or create an account
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key (it starts with `sk-`)

### Step 2: Configure the API Key in Supabase

The API key needs to be added as a secret in your Supabase project:

1. Go to your Supabase project dashboard
2. Navigate to **Project Settings** → **Edge Functions**
3. Under **Secrets**, add a new secret:
   - Name: `OPENAI_API_KEY`
   - Value: Your OpenAI API key

### Step 3: Usage

Once configured, you'll see an "AI Auto-Fill" button on each step of the questionnaire:

1. Click the button with the sparkle icon
2. Wait for the AI to analyze current market conditions
3. Review and edit the populated data as needed
4. Proceed to the next step

## Important Notes

- The AI feature requires an active OpenAI API subscription
- API calls to OpenAI will incur costs based on your usage
- The AI provides current market data estimates - always verify critical information
- You can always manually edit any field after AI population
- If the AI service is not configured, you can still fill all data manually

## Fallback

If you don't configure the OpenAI API key:
- The app will still work perfectly
- You'll need to manually enter all data
- All other features (analysis, recommendations, options strategies) will work normally

## Cost Considerations

- Each AI auto-fill request uses GPT-4
- Typical cost per analysis: $0.10 - $0.30
- You control when to use AI auto-fill
- Manual data entry is always free
