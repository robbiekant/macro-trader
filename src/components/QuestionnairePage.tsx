import { useState } from 'react';
import { ChevronRight, Loader2, Sparkles, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface QuestionnaireData {
  businessCycle: string;
  economicCycle: string;
  globalLiquidity: string;
  macroOutlook: string;
  interestRates: Array<{
    country: string;
    rate: string;
    direction: string;
    policy: string;
  }>;
  marketValuations: Array<{
    index: string;
    peRatio: string;
    level: string;
  }>;
  commodities: Array<{
    name: string;
    supply: string;
    demand: string;
    bias: string;
  }>;
}

const COUNTRIES = ['USA', 'EU', 'Japan', 'China', 'UK', 'Canada', 'Australia'];
const SECTORS = ['S&P 500', 'Technology', 'Healthcare', 'Financials', 'Energy', 'Consumer Discretionary', 'Industrials', 'Materials', 'Real Estate', 'Utilities', 'Communications'];
const COMMODITIES = ['Gold', 'Silver', 'Crude Oil', 'Natural Gas', 'Wheat', 'Copper'];

interface Props {
  onComplete: (snapshotId: string) => void;
}

export default function QuestionnairePage({ onComplete }: Props) {
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [showPrompt, setShowPrompt] = useState<string | null>(null);
  const [customPrompts, setCustomPrompts] = useState<Record<string, string>>({
    general: '',
    interest_rates: '',
    valuations: '',
    commodities: ''
  });

  const [data, setData] = useState<QuestionnaireData>({
    businessCycle: '',
    economicCycle: '',
    globalLiquidity: '',
    macroOutlook: '',
    interestRates: COUNTRIES.map(country => ({
      country,
      rate: '',
      direction: '',
      policy: ''
    })),
    marketValuations: SECTORS.map(sector => ({
      index: sector,
      peRatio: '',
      level: ''
    })),
    commodities: COMMODITIES.map(name => ({
      name,
      supply: '',
      demand: '',
      bias: ''
    }))
  });

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: snapshot, error: snapshotError } = await supabase
        .from('macro_snapshots')
        .insert({
          user_id: user.id,
          business_cycle: data.businessCycle,
          economic_cycle: data.economicCycle,
          global_liquidity: data.globalLiquidity,
          macro_outlook: data.macroOutlook,
          snapshot_data: data
        })
        .select()
        .single();

      if (snapshotError) throw snapshotError;

      const interestRatesData = data.interestRates.map(ir => ({
        snapshot_id: snapshot.id,
        country: ir.country,
        current_rate: parseFloat(ir.rate) || 0,
        direction: ir.direction,
        policy_stance: ir.policy
      }));

      await supabase.from('interest_rates').insert(interestRatesData);

      const valuationsData = data.marketValuations.map(mv => ({
        snapshot_id: snapshot.id,
        index_name: mv.index,
        pe_ratio: parseFloat(mv.peRatio) || 0,
        valuation_level: mv.level
      }));

      await supabase.from('market_valuations').insert(valuationsData);

      const commoditiesData = data.commodities.map(c => ({
        snapshot_id: snapshot.id,
        commodity: c.name,
        supply_outlook: c.supply,
        demand_outlook: c.demand,
        fundamental_bias: c.bias
      }));

      await supabase.from('commodity_fundamentals').insert(commoditiesData);

      onComplete(snapshot.id);
    } catch (error) {
      console.error('Error saving data:', error);
      alert('Failed to save data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getPromptForSection = (section: string): string => {
    switch (section) {
      case 'general':
        return `Analyze current global macro economic conditions and provide:

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
      case 'interest_rates':
        return `Provide current interest rate data for these countries: USA, EU, Japan, China, UK, Canada, Australia.

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
      case 'valuations':
        return `Provide current P/E ratio data for S&P 500 and major sectors: Technology, Healthcare, Financials, Energy, Consumer Discretionary, Industrials, Materials, Real Estate, Utilities, Communications.

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
      case 'commodities':
        return `Analyze supply and demand fundamentals for these commodities: Gold, Silver, Crude Oil, Natural Gas, Wheat, Copper.

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
      default:
        return '';
    }
  };

  const callAiFunction = async (section: string) => {
    setAiLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-macro-analysis`;

      const requestBody: any = { section };
      if (customPrompts[section]) {
        requestBody.customPrompt = customPrompts[section];
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'AI analysis failed');
      }

      return result.data;
    } catch (error: any) {
      console.error('AI error:', error);
      alert(error.message || 'Failed to get AI analysis. You can fill the data manually.');
      return null;
    } finally {
      setAiLoading(false);
    }
  };

  const handleAiGeneralAnalysis = async () => {
    const result = await callAiFunction('general');
    if (result) {
      setData({
        ...data,
        businessCycle: result.businessCycle || data.businessCycle,
        economicCycle: result.economicCycle || data.economicCycle,
        globalLiquidity: result.globalLiquidity || data.globalLiquidity,
        macroOutlook: result.macroOutlook || data.macroOutlook,
      });
    }
  };

  const handleAiInterestRates = async () => {
    const result = await callAiFunction('interest_rates');
    if (result && result.rates) {
      const updatedRates = data.interestRates.map(ir => {
        const aiRate = result.rates.find((r: any) => r.country === ir.country);
        if (aiRate) {
          return {
            country: ir.country,
            rate: aiRate.rate || ir.rate,
            direction: aiRate.direction || ir.direction,
            policy: aiRate.policy || ir.policy,
          };
        }
        return ir;
      });
      setData({ ...data, interestRates: updatedRates });
    }
  };

  const handleAiValuations = async () => {
    const result = await callAiFunction('valuations');
    if (result && result.valuations) {
      const updatedValuations = data.marketValuations.map(mv => {
        const aiVal = result.valuations.find((v: any) => v.index === mv.index);
        if (aiVal) {
          return {
            index: mv.index,
            peRatio: aiVal.peRatio || mv.peRatio,
            level: aiVal.level || mv.level,
          };
        }
        return mv;
      });
      setData({ ...data, marketValuations: updatedValuations });
    }
  };

  const handleAiCommodities = async () => {
    const result = await callAiFunction('commodities');
    if (result && result.commodities) {
      const updatedCommodities = data.commodities.map(c => {
        const aiComm = result.commodities.find((cm: any) => cm.name === c.name);
        if (aiComm) {
          return {
            name: c.name,
            supply: aiComm.supply || c.supply,
            demand: aiComm.demand || c.demand,
            bias: aiComm.bias || c.bias,
          };
        }
        return c;
      });
      setData({ ...data, commodities: updatedCommodities });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Macro Economic Analysis</h1>
            <p className="text-slate-600">Comprehensive market data collection for investment strategy</p>
          </div>

          <div className="flex items-center justify-between mb-8">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  step >= s ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
                }`}>
                  {s}
                </div>
                {s < 4 && (
                  <div className={`w-24 h-1 mx-2 ${step > s ? 'bg-blue-600' : 'bg-slate-200'}`} />
                )}
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-6">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl font-semibold text-slate-800">General Macro Conditions</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowPrompt(showPrompt === 'general' ? null : 'general')}
                      className="flex items-center gap-2 px-3 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-all text-sm"
                    >
                      {showPrompt === 'general' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      {showPrompt === 'general' ? 'Hide' : 'View'} Prompt
                    </button>
                    <button
                      onClick={handleAiGeneralAnalysis}
                      disabled={aiLoading}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-violet-600 text-white rounded-lg hover:from-blue-700 hover:to-violet-700 transition-all disabled:opacity-50"
                    >
                      {aiLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          AI Analyzing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          AI Auto-Fill
                        </>
                      )}
                    </button>
                  </div>
                </div>
                {showPrompt === 'general' && (
                  <div className="bg-slate-50 border border-slate-300 rounded-lg p-4 space-y-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-700 mb-2">AI Prompt Being Sent:</h3>
                      <pre className="text-xs text-slate-600 whitespace-pre-wrap bg-white p-3 rounded border border-slate-200 max-h-48 overflow-y-auto">
                        {getPromptForSection('general')}
                      </pre>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Add Your Custom Instructions (Optional):
                      </label>
                      <textarea
                        className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        rows={3}
                        value={customPrompts.general}
                        onChange={(e) => setCustomPrompts({ ...customPrompts, general: e.target.value })}
                        placeholder="Add any additional context or instructions for the AI..."
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Current Business Cycle Phase
                </label>
                <select
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={data.businessCycle}
                  onChange={(e) => setData({ ...data, businessCycle: e.target.value })}
                >
                  <option value="">Select phase</option>
                  <option value="expansion">Expansion</option>
                  <option value="peak">Peak</option>
                  <option value="contraction">Contraction</option>
                  <option value="trough">Trough</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Economic Cycle Assessment
                </label>
                <textarea
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  value={data.economicCycle}
                  onChange={(e) => setData({ ...data, economicCycle: e.target.value })}
                  placeholder="Describe the current economic cycle..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Global Liquidity Conditions
                </label>
                <select
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={data.globalLiquidity}
                  onChange={(e) => setData({ ...data, globalLiquidity: e.target.value })}
                >
                  <option value="">Select condition</option>
                  <option value="abundant">Abundant</option>
                  <option value="adequate">Adequate</option>
                  <option value="tight">Tight</option>
                  <option value="crisis">Crisis</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Overall Macro Outlook
                </label>
                <textarea
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  value={data.macroOutlook}
                  onChange={(e) => setData({ ...data, macroOutlook: e.target.value })}
                  placeholder="Your overall assessment of macro conditions..."
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl font-semibold text-slate-800">Interest Rates & Monetary Policy</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowPrompt(showPrompt === 'interest_rates' ? null : 'interest_rates')}
                      className="flex items-center gap-2 px-3 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-all text-sm"
                    >
                      {showPrompt === 'interest_rates' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      {showPrompt === 'interest_rates' ? 'Hide' : 'View'} Prompt
                    </button>
                    <button
                      onClick={handleAiInterestRates}
                      disabled={aiLoading}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-violet-600 text-white rounded-lg hover:from-blue-700 hover:to-violet-700 transition-all disabled:opacity-50"
                    >
                      {aiLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          AI Analyzing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          AI Auto-Fill
                        </>
                      )}
                    </button>
                  </div>
                </div>
                {showPrompt === 'interest_rates' && (
                  <div className="bg-slate-50 border border-slate-300 rounded-lg p-4 space-y-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-700 mb-2">AI Prompt Being Sent:</h3>
                      <pre className="text-xs text-slate-600 whitespace-pre-wrap bg-white p-3 rounded border border-slate-200 max-h-48 overflow-y-auto">
                        {getPromptForSection('interest_rates')}
                      </pre>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Add Your Custom Instructions (Optional):
                      </label>
                      <textarea
                        className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        rows={3}
                        value={customPrompts.interest_rates}
                        onChange={(e) => setCustomPrompts({ ...customPrompts, interest_rates: e.target.value })}
                        placeholder="Add any additional context or instructions for the AI..."
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-4 font-medium text-slate-700">Country</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-700">Rate (%)</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-700">Direction</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-700">Policy Stance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.interestRates.map((ir, idx) => (
                      <tr key={ir.country} className="border-b border-slate-100">
                        <td className="py-3 px-4 font-medium text-slate-800">{ir.country}</td>
                        <td className="py-3 px-4">
                          <input
                            type="number"
                            step="0.25"
                            className="w-full px-3 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            value={ir.rate}
                            onChange={(e) => {
                              const newRates = [...data.interestRates];
                              newRates[idx].rate = e.target.value;
                              setData({ ...data, interestRates: newRates });
                            }}
                          />
                        </td>
                        <td className="py-3 px-4">
                          <select
                            className="w-full px-3 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            value={ir.direction}
                            onChange={(e) => {
                              const newRates = [...data.interestRates];
                              newRates[idx].direction = e.target.value;
                              setData({ ...data, interestRates: newRates });
                            }}
                          >
                            <option value="">Select</option>
                            <option value="rising">Rising</option>
                            <option value="stable">Stable</option>
                            <option value="falling">Falling</option>
                          </select>
                        </td>
                        <td className="py-3 px-4">
                          <select
                            className="w-full px-3 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            value={ir.policy}
                            onChange={(e) => {
                              const newRates = [...data.interestRates];
                              newRates[idx].policy = e.target.value;
                              setData({ ...data, interestRates: newRates });
                            }}
                          >
                            <option value="">Select</option>
                            <option value="QE">Quantitative Easing</option>
                            <option value="QT">Quantitative Tightening</option>
                            <option value="neutral">Neutral</option>
                            <option value="printing">Money Printing</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl font-semibold text-slate-800">Market Valuations</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowPrompt(showPrompt === 'valuations' ? null : 'valuations')}
                      className="flex items-center gap-2 px-3 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-all text-sm"
                    >
                      {showPrompt === 'valuations' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      {showPrompt === 'valuations' ? 'Hide' : 'View'} Prompt
                    </button>
                    <button
                      onClick={handleAiValuations}
                      disabled={aiLoading}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-violet-600 text-white rounded-lg hover:from-blue-700 hover:to-violet-700 transition-all disabled:opacity-50"
                    >
                      {aiLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          AI Analyzing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          AI Auto-Fill
                        </>
                      )}
                    </button>
                  </div>
                </div>
                {showPrompt === 'valuations' && (
                  <div className="bg-slate-50 border border-slate-300 rounded-lg p-4 space-y-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-700 mb-2">AI Prompt Being Sent:</h3>
                      <pre className="text-xs text-slate-600 whitespace-pre-wrap bg-white p-3 rounded border border-slate-200 max-h-48 overflow-y-auto">
                        {getPromptForSection('valuations')}
                      </pre>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Add Your Custom Instructions (Optional):
                      </label>
                      <textarea
                        className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        rows={3}
                        value={customPrompts.valuations}
                        onChange={(e) => setCustomPrompts({ ...customPrompts, valuations: e.target.value })}
                        placeholder="Add any additional context or instructions for the AI..."
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-4 font-medium text-slate-700">Index/Sector</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-700">P/E Ratio</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-700">Valuation Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.marketValuations.map((mv, idx) => (
                      <tr key={mv.index} className="border-b border-slate-100">
                        <td className="py-3 px-4 font-medium text-slate-800">{mv.index}</td>
                        <td className="py-3 px-4">
                          <input
                            type="number"
                            step="0.1"
                            className="w-full px-3 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            value={mv.peRatio}
                            onChange={(e) => {
                              const newValuations = [...data.marketValuations];
                              newValuations[idx].peRatio = e.target.value;
                              setData({ ...data, marketValuations: newValuations });
                            }}
                          />
                        </td>
                        <td className="py-3 px-4">
                          <select
                            className="w-full px-3 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            value={mv.level}
                            onChange={(e) => {
                              const newValuations = [...data.marketValuations];
                              newValuations[idx].level = e.target.value;
                              setData({ ...data, marketValuations: newValuations });
                            }}
                          >
                            <option value="">Select</option>
                            <option value="cheap">Cheap</option>
                            <option value="fair">Fair</option>
                            <option value="expensive">Expensive</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl font-semibold text-slate-800">Commodity Fundamentals</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowPrompt(showPrompt === 'commodities' ? null : 'commodities')}
                      className="flex items-center gap-2 px-3 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-all text-sm"
                    >
                      {showPrompt === 'commodities' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      {showPrompt === 'commodities' ? 'Hide' : 'View'} Prompt
                    </button>
                    <button
                      onClick={handleAiCommodities}
                      disabled={aiLoading}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-violet-600 text-white rounded-lg hover:from-blue-700 hover:to-violet-700 transition-all disabled:opacity-50"
                    >
                      {aiLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          AI Analyzing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          AI Auto-Fill
                        </>
                      )}
                    </button>
                  </div>
                </div>
                {showPrompt === 'commodities' && (
                  <div className="bg-slate-50 border border-slate-300 rounded-lg p-4 space-y-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-700 mb-2">AI Prompt Being Sent:</h3>
                      <pre className="text-xs text-slate-600 whitespace-pre-wrap bg-white p-3 rounded border border-slate-200 max-h-48 overflow-y-auto">
                        {getPromptForSection('commodities')}
                      </pre>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Add Your Custom Instructions (Optional):
                      </label>
                      <textarea
                        className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        rows={3}
                        value={customPrompts.commodities}
                        onChange={(e) => setCustomPrompts({ ...customPrompts, commodities: e.target.value })}
                        placeholder="Add any additional context or instructions for the AI..."
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-4 font-medium text-slate-700">Commodity</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-700">Supply Outlook</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-700">Demand Outlook</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-700">Fundamental Bias</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.commodities.map((c, idx) => (
                      <tr key={c.name} className="border-b border-slate-100">
                        <td className="py-3 px-4 font-medium text-slate-800">{c.name}</td>
                        <td className="py-3 px-4">
                          <select
                            className="w-full px-3 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            value={c.supply}
                            onChange={(e) => {
                              const newCommodities = [...data.commodities];
                              newCommodities[idx].supply = e.target.value;
                              setData({ ...data, commodities: newCommodities });
                            }}
                          >
                            <option value="">Select</option>
                            <option value="shortage">Shortage</option>
                            <option value="balanced">Balanced</option>
                            <option value="surplus">Surplus</option>
                          </select>
                        </td>
                        <td className="py-3 px-4">
                          <select
                            className="w-full px-3 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            value={c.demand}
                            onChange={(e) => {
                              const newCommodities = [...data.commodities];
                              newCommodities[idx].demand = e.target.value;
                              setData({ ...data, commodities: newCommodities });
                            }}
                          >
                            <option value="">Select</option>
                            <option value="strong">Strong</option>
                            <option value="moderate">Moderate</option>
                            <option value="weak">Weak</option>
                          </select>
                        </td>
                        <td className="py-3 px-4">
                          <select
                            className="w-full px-3 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            value={c.bias}
                            onChange={(e) => {
                              const newCommodities = [...data.commodities];
                              newCommodities[idx].bias = e.target.value;
                              setData({ ...data, commodities: newCommodities });
                            }}
                          >
                            <option value="">Select</option>
                            <option value="bullish">Bullish</option>
                            <option value="neutral">Neutral</option>
                            <option value="bearish">Bearish</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-between mt-8">
            <button
              onClick={() => setStep(Math.max(1, step - 1))}
              disabled={step === 1}
              className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>

            {step < 4 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    Complete & Analyze
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
