import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  section: 'general' | 'interest_rates' | 'valuations' | 'commodities';
  context?: any;
  customPrompt?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { section, context, customPrompt }: RequestBody = await req.json();

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({
          error: 'AI service not configured',
          message: 'Please configure OPENAI_API_KEY in your environment variables'
        }),
        {
          status: 503,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    let prompt = '';
    let systemPrompt = 'You are a financial analyst providing current macro economic data. Respond with accurate, current market data in JSON format.';

    switch (section) {
      case 'general':
        prompt = `Analyze current global macro economic conditions and provide:

1. Current business cycle phase (expansion, peak, contraction, or trough)
2. Economic cycle assessment (2-3 sentences about current economic conditions)
3. Global liquidity conditions (abundant, adequate, tight, or crisis)
4. Overall macro outlook (3-4 sentences summarizing the macro picture)

Respond in JSON format:
{
  "businessCycle": "expansion/peak/contraction/trough",
  "economicCycle": "detailed assessment",
  "globalLiquidity": "abundant/adequate/tight/crisis",
  "macroOutlook": "overall outlook"
}`;
        break;

      case 'interest_rates':
        prompt = `Provide current interest rate data for these countries: USA, EU, Japan, China, UK, Canada, Australia.

For each country provide:
1. Current policy rate (as percentage)
2. Rate direction (rising, stable, or falling)
3. Monetary policy stance (QE, QT, neutral, or printing)

Respond in JSON format:
{
  "rates": [
    {
      "country": "USA",
      "rate": "5.5",
      "direction": "stable",
      "policy": "neutral"
    },
    // ... for all countries
  ]
}`;
        break;

      case 'valuations':
        prompt = `Provide current P/E ratio data for S&P 500 and major sectors: Technology, Healthcare, Financials, Energy, Consumer Discretionary, Industrials, Materials, Real Estate, Utilities, Communications.

For each provide:
1. Current P/E ratio
2. Valuation level (cheap, fair, or expensive)

Respond in JSON format:
{
  "valuations": [
    {
      "index": "S&P 500",
      "peRatio": "22.5",
      "level": "fair"
    },
    // ... for all sectors
  ]
}`;
        break;

      case 'commodities':
        prompt = `Analyze supply and demand fundamentals for these commodities: Gold, Silver, Crude Oil, Natural Gas, Wheat, Copper.

For each provide:
1. Supply outlook (shortage, balanced, or surplus)
2. Demand outlook (strong, moderate, or weak)
3. Fundamental bias (bullish, neutral, or bearish)

Respond in JSON format:
{
  "commodities": [
    {
      "name": "Gold",
      "supply": "balanced",
      "demand": "strong",
      "bias": "bullish"
    },
    // ... for all commodities
  ]
}`;
        break;
    }

    if (customPrompt) {
      prompt = `${prompt}\n\nAdditional instructions: ${customPrompt}`;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const parsedData = JSON.parse(content);

    return new Response(
      JSON.stringify({ success: true, data: parsedData }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to generate analysis',
        message: error.message
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});