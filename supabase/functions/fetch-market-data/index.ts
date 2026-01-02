import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ASSETS = [
  { symbol: 'ES', name: 'E-mini S&P 500', estimatedSpot: 5800, estimatedIV: 0.15 },
  { symbol: 'NQ', name: 'E-mini Nasdaq', estimatedSpot: 20500, estimatedIV: 0.18 },
  { symbol: 'GC', name: 'Gold Futures', estimatedSpot: 2650, estimatedIV: 0.12 },
  { symbol: 'SI', name: 'Silver Futures', estimatedSpot: 30.5, estimatedIV: 0.22 },
  { symbol: 'CL', name: 'Crude Oil', estimatedSpot: 70, estimatedIV: 0.35 },
  { symbol: 'NG', name: 'Natural Gas', estimatedSpot: 3.5, estimatedIV: 0.45 },
  { symbol: 'HG', name: 'Copper Futures', estimatedSpot: 4.2, estimatedIV: 0.20 },
  { symbol: 'ZW', name: 'Wheat Futures', estimatedSpot: 550, estimatedIV: 0.25 },
  { symbol: 'MBT', name: '10-Year Treasury Note', estimatedSpot: 110, estimatedIV: 0.08 },
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const marketData = ASSETS.map(asset => ({
      symbol: asset.symbol,
      name: asset.name,
      spotPrice: asset.estimatedSpot,
      impliedVolatility: asset.estimatedIV,
      ivRank: 50,
      timestamp: new Date().toISOString(),
      source: 'estimated',
    }));

    return new Response(
      JSON.stringify({
        success: true,
        data: marketData,
        message: 'Market data fetched successfully. Note: These are estimated values for demonstration.',
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('Error fetching market data:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to fetch market data',
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