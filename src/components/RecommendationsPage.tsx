import { useEffect, useState } from 'react';
import { ChevronRight, Loader2, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Recommendation {
  id: string;
  asset_class: string;
  recommendation: string;
  conviction_level: string;
  time_horizon: string;
  rationale: string;
}

interface Props {
  snapshotId: string;
  onContinue: () => void;
}

const ASSET_CLASSES = [
  'S&P 500 Index',
  'Technology Stocks',
  'Healthcare Stocks',
  'Financial Stocks',
  'Energy Stocks',
  'Gold',
  'Silver',
  'Crude Oil',
  'Natural Gas',
  'Copper',
  'US Treasury Bonds',
  'Corporate Bonds',
  'Real Estate'
];

export default function RecommendationsPage({ snapshotId, onContinue }: Props) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadRecommendations();
  }, [snapshotId]);

  const loadRecommendations = async () => {
    try {
      const { data } = await supabase
        .from('ai_recommendations')
        .select('*')
        .eq('snapshot_id', snapshotId);

      if (data && data.length > 0) {
        setRecommendations(data);
      } else {
        await generateRecommendations();
      }
    } catch (error) {
      console.error('Error loading recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateRecommendations = async () => {
    setGenerating(true);
    try {
      const { data: snapshot } = await supabase
        .from('macro_snapshots')
        .select('*')
        .eq('id', snapshotId)
        .single();

      const { data: interestRates } = await supabase
        .from('interest_rates')
        .select('*')
        .eq('snapshot_id', snapshotId);

      const { data: marketValuations } = await supabase
        .from('market_valuations')
        .select('*')
        .eq('snapshot_id', snapshotId);

      const { data: commodities } = await supabase
        .from('commodity_fundamentals')
        .select('*')
        .eq('snapshot_id', snapshotId);

      const inputData = {
        macroSnapshot: snapshot,
        interestRates: interestRates || [],
        marketValuations: marketValuations || [],
        commodityFundamentals: commodities || [],
        assetClasses: ASSET_CLASSES
      };

      const analysisLogic = `# Investment Recommendation Analysis Logic

## Overview
This system generates conservative 6-month swing trading recommendations by analyzing macro economic conditions and applying rule-based investment logic.

## Input Data Sources
1. Macro Snapshot: Business cycle phase, economic cycle assessment, global liquidity conditions, and overall macro outlook
2. Interest Rates: Policy rates, rate direction, and monetary policy stance for major economies (USA, EU, Japan, China, UK, Canada, Australia)
3. Market Valuations: P/E ratios and valuation levels for S&P 500 and major sectors
4. Commodity Fundamentals: Supply/demand outlook and fundamental bias for key commodities (Gold, Silver, Crude Oil, Natural Gas, Wheat, Copper)

## Analysis Rules by Asset Class

### Equities (S&P 500, Technology, Healthcare, Financial, Energy Stocks)
**BUY Signal (High Conviction):**
- Business cycle is in expansion phase
- Global liquidity is abundant
- Valuations are not expensive

**SELL Signal (Medium Conviction):**
- Business cycle is in contraction
- Global liquidity is tight
- Valuations are expensive AND interest rates are rising

**SELL Signal (Low Conviction if cheap):**
- Same conditions as above but valuations are cheap

### Gold
**BUY Signal (High Conviction):**
- Global liquidity is abundant OR interest rates are falling
- Gold fundamentals are bullish

**SELL Signal (Medium Conviction):**
- Interest rates are rising
- Gold fundamentals are bearish

### Industrial Metals (Silver, Copper)
**BUY Signal (High Conviction):**
- Business cycle is in expansion
- Demand outlook is strong

**SELL Signal (Medium Conviction):**
- Business cycle is in contraction
- Supply outlook shows surplus

### Energy (Crude Oil, Natural Gas)
**BUY Signal (High Conviction):**
- Business cycle is in expansion
- Supply outlook shows shortage

**SELL Signal (Medium Conviction):**
- Business cycle is in contraction
- Supply outlook shows surplus

### Bonds (US Treasury, Corporate)
**BUY Signal (Medium Conviction):**
- Interest rates are falling OR business cycle is in contraction
- Safe haven demand increases

**SELL Signal (Medium Conviction):**
- Interest rates are rising AND business cycle is in expansion
- Reduced safe haven appeal

### Real Estate
**BUY Signal (Medium Conviction):**
- Interest rates are falling AND business cycle is in expansion
- Lower financing costs support property values

**SELL Signal (Medium Conviction):**
- Interest rates are rising OR business cycle is in contraction
- Higher financing costs reduce property demand

### Default (Hold)
**HOLD Signal (Low Conviction):**
- Mixed signals from macro indicators
- No clear trend emerges from the analysis

## Output Format
For each asset class, the system generates:
1. Recommendation: buy, sell, or hold
2. Conviction Level: high, medium, or low
3. Time Horizon: 6 months
4. Rationale: Brief explanation of the recommendation based on the rules applied`;

      const generatedRecommendations = ASSET_CLASSES.map(assetClass => {
        const { recommendation, conviction, rationale } = analyzeAsset(
          assetClass,
          snapshot,
          interestRates || [],
          marketValuations || [],
          commodities || []
        );

        return {
          snapshot_id: snapshotId,
          asset_class: assetClass,
          recommendation,
          conviction_level: conviction,
          time_horizon: '6 months',
          rationale
        };
      });

      const { data: inserted } = await supabase
        .from('ai_recommendations')
        .insert(generatedRecommendations)
        .select();

      const outputData = {
        recommendations: generatedRecommendations,
        summary: {
          totalAssets: generatedRecommendations.length,
          buySignals: generatedRecommendations.filter(r => r.recommendation === 'buy').length,
          sellSignals: generatedRecommendations.filter(r => r.recommendation === 'sell').length,
          holdSignals: generatedRecommendations.filter(r => r.recommendation === 'hold').length
        },
        generatedAt: new Date().toISOString()
      };

      await supabase
        .from('macro_snapshots')
        .update({
          analysis_input_data: inputData,
          analysis_logic: analysisLogic,
          analysis_output_data: outputData
        })
        .eq('id', snapshotId);

      if (inserted) {
        setRecommendations(inserted);
      }
    } catch (error) {
      console.error('Error generating recommendations:', error);
    } finally {
      setGenerating(false);
    }
  };

  const analyzeAsset = (
    assetClass: string,
    snapshot: any,
    interestRates: any[],
    valuations: any[],
    commodities: any[]
  ) => {
    const isExpansion = snapshot?.business_cycle === 'expansion';
    const isContraction = snapshot?.business_cycle === 'contraction';
    const isLiquidityAbundant = snapshot?.global_liquidity === 'abundant';
    const isLiquidityTight = snapshot?.global_liquidity === 'tight';

    const usRate = interestRates.find(r => r.country === 'USA');
    const ratesRising = usRate?.direction === 'rising';
    const ratesFalling = usRate?.direction === 'falling';

    if (assetClass.includes('S&P 500') || assetClass.includes('Technology') || assetClass.includes('Stocks')) {
      const valuation = valuations.find(v => v.index_name.includes(assetClass.split(' ')[0]));
      const isExpensive = valuation?.valuation_level === 'expensive';
      const isCheap = valuation?.valuation_level === 'cheap';

      if (isExpansion && isLiquidityAbundant && !isExpensive) {
        return {
          recommendation: 'buy',
          conviction: 'high',
          rationale: 'Expansion cycle with abundant liquidity supports equity prices. Valuation is reasonable for entry.'
        };
      } else if (isContraction || isLiquidityTight || (isExpensive && ratesRising)) {
        return {
          recommendation: 'sell',
          conviction: isCheap ? 'low' : 'medium',
          rationale: 'Headwinds from economic contraction, tight liquidity, or expensive valuations suggest caution.'
        };
      }
    }

    if (assetClass.includes('Gold')) {
      const goldFundamentals = commodities.find(c => c.commodity === 'Gold');
      if ((isLiquidityAbundant || ratesFalling) && goldFundamentals?.fundamental_bias === 'bullish') {
        return {
          recommendation: 'buy',
          conviction: 'high',
          rationale: 'Falling rates and abundant liquidity are bullish for gold. Strong fundamental support.'
        };
      } else if (ratesRising && goldFundamentals?.fundamental_bias === 'bearish') {
        return {
          recommendation: 'sell',
          conviction: 'medium',
          rationale: 'Rising rates typically pressure gold prices. Bearish fundamentals confirm the trend.'
        };
      }
    }

    if (assetClass.includes('Silver') || assetClass.includes('Copper')) {
      const commodity = commodities.find(c => c.commodity === assetClass.split(' ')[0]);
      if (isExpansion && commodity?.demand_outlook === 'strong') {
        return {
          recommendation: 'buy',
          conviction: 'high',
          rationale: 'Economic expansion drives industrial metal demand. Strong fundamentals support prices.'
        };
      } else if (isContraction && commodity?.supply_outlook === 'surplus') {
        return {
          recommendation: 'sell',
          conviction: 'medium',
          rationale: 'Contraction reduces demand while supply remains elevated. Bearish setup.'
        };
      }
    }

    if (assetClass.includes('Oil') || assetClass.includes('Gas')) {
      const commodity = commodities.find(c => assetClass.includes(c.commodity.split(' ')[0]));
      if (isExpansion && commodity?.supply_outlook === 'shortage') {
        return {
          recommendation: 'buy',
          conviction: 'high',
          rationale: 'Economic growth increases energy demand. Supply constraints support higher prices.'
        };
      } else if (isContraction && commodity?.supply_outlook === 'surplus') {
        return {
          recommendation: 'sell',
          conviction: 'medium',
          rationale: 'Demand destruction from economic weakness combined with supply surplus pressures prices.'
        };
      }
    }

    if (assetClass.includes('Bonds')) {
      if (ratesFalling || isContraction) {
        return {
          recommendation: 'buy',
          conviction: 'medium',
          rationale: 'Falling rates or economic contraction support bond prices as safe haven demand increases.'
        };
      } else if (ratesRising && isExpansion) {
        return {
          recommendation: 'sell',
          conviction: 'medium',
          rationale: 'Rising rate environment pressures bond prices. Expansion reduces safe haven appeal.'
        };
      }
    }

    if (assetClass.includes('Real Estate')) {
      if (ratesFalling && isExpansion) {
        return {
          recommendation: 'buy',
          conviction: 'medium',
          rationale: 'Lower rates reduce financing costs while expansion supports property values.'
        };
      } else if (ratesRising || isContraction) {
        return {
          recommendation: 'sell',
          conviction: 'medium',
          rationale: 'Higher rates increase financing costs. Economic weakness reduces property demand.'
        };
      }
    }

    return {
      recommendation: 'hold',
      conviction: 'low',
      rationale: 'Mixed signals from macro indicators suggest a neutral stance until clearer trends emerge.'
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-slate-600">Loading recommendations...</div>
      </div>
    );
  }

  const buyRecommendations = recommendations.filter(r => r.recommendation === 'buy');
  const sellRecommendations = recommendations.filter(r => r.recommendation === 'sell');
  const holdRecommendations = recommendations.filter(r => r.recommendation === 'hold');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">AI Investment Recommendations</h1>
          <p className="text-slate-600">Conservative 6-month swing trading outlook based on macro analysis</p>
        </div>

        {generating && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            <p className="text-blue-800">Analyzing macro conditions and generating recommendations...</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-green-50 border border-green-200 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <TrendingUp className="w-6 h-6 text-green-600" />
              <h3 className="text-lg font-semibold text-green-900">Buy Signals</h3>
            </div>
            <p className="text-3xl font-bold text-green-700">{buyRecommendations.length}</p>
            <p className="text-sm text-green-600 mt-1">Assets to consider for long positions</p>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <TrendingDown className="w-6 h-6 text-red-600" />
              <h3 className="text-lg font-semibold text-red-900">Sell Signals</h3>
            </div>
            <p className="text-3xl font-bold text-red-700">{sellRecommendations.length}</p>
            <p className="text-sm text-red-600 mt-1">Assets to consider for short positions</p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <AlertCircle className="w-6 h-6 text-slate-600" />
              <h3 className="text-lg font-semibold text-slate-900">Hold/Neutral</h3>
            </div>
            <p className="text-3xl font-bold text-slate-700">{holdRecommendations.length}</p>
            <p className="text-sm text-slate-600 mt-1">Assets with mixed signals</p>
          </div>
        </div>

        <div className="space-y-6">
          {buyRecommendations.length > 0 && (
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-xl font-bold text-green-700 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Buy Recommendations
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {buyRecommendations.map((rec) => (
                  <div key={rec.id} className="border border-green-200 bg-green-50 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-slate-900">{rec.asset_class}</h3>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        rec.conviction_level === 'high' ? 'bg-green-600 text-white' :
                        rec.conviction_level === 'medium' ? 'bg-green-500 text-white' :
                        'bg-green-400 text-white'
                      }`}>
                        {rec.conviction_level} conviction
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 mb-2">{rec.rationale}</p>
                    <p className="text-xs text-slate-500">Time horizon: {rec.time_horizon}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {sellRecommendations.length > 0 && (
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-xl font-bold text-red-700 mb-4 flex items-center gap-2">
                <TrendingDown className="w-5 h-5" />
                Sell Recommendations
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {sellRecommendations.map((rec) => (
                  <div key={rec.id} className="border border-red-200 bg-red-50 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-slate-900">{rec.asset_class}</h3>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        rec.conviction_level === 'high' ? 'bg-red-600 text-white' :
                        rec.conviction_level === 'medium' ? 'bg-red-500 text-white' :
                        'bg-red-400 text-white'
                      }`}>
                        {rec.conviction_level} conviction
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 mb-2">{rec.rationale}</p>
                    <p className="text-xs text-slate-500">Time horizon: {rec.time_horizon}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {holdRecommendations.length > 0 && (
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-xl font-bold text-slate-700 mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Neutral Positions
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {holdRecommendations.map((rec) => (
                  <div key={rec.id} className="border border-slate-200 bg-slate-50 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-slate-900">{rec.asset_class}</h3>
                      <span className="px-2 py-1 rounded text-xs font-medium bg-slate-400 text-white">
                        {rec.conviction_level} conviction
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 mb-2">{rec.rationale}</p>
                    <p className="text-xs text-slate-500">Time horizon: {rec.time_horizon}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 bg-white rounded-xl shadow-md p-6">
          <button
            onClick={onContinue}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-semibold"
          >
            Continue to Asset Data & Portfolio Generation
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
