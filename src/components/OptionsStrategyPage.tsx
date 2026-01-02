import { useEffect, useState } from 'react';
import { DollarSign, Loader2, Edit2, Check, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { calculateOptionPrice, calculateStranglePremium, calculateBuyingPower } from '../lib/bsm';

interface Recommendation {
  id: string;
  asset_class: string;
  recommendation: string;
  conviction_level: string;
}

interface OptionStrategy {
  id?: string;
  recommendation_id: string;
  asset_class: string;
  strategy_type: 'short_put' | 'short_call' | 'short_strangle';
  dte: number;
  spot_price: number;
  implied_volatility: number;
  strike_price: number;
  strike_price_put: number;
  strike_price_call: number;
  premium_collected: number;
  buying_power_required: number;
  manual_input: boolean;
}

interface Props {
  snapshotId: string;
}

export default function OptionsStrategyPage({ snapshotId }: Props) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [strategies, setStrategies] = useState<OptionStrategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<OptionStrategy>>({});

  useEffect(() => {
    loadData();
  }, [snapshotId]);

  const loadData = async () => {
    try {
      const { data: recs } = await supabase
        .from('ai_recommendations')
        .select('*')
        .eq('snapshot_id', snapshotId)
        .in('recommendation', ['buy', 'sell']);

      if (recs) {
        setRecommendations(recs);

        const { data: existingStrategies } = await supabase
          .from('options_strategies')
          .select('*')
          .in('recommendation_id', recs.map(r => r.id));

        if (existingStrategies && existingStrategies.length > 0) {
          setStrategies(existingStrategies);
        } else {
          await generateStrategies(recs);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateStrategies = async (recs: Recommendation[]) => {
    setGenerating(true);
    try {
      const generatedStrategies: OptionStrategy[] = [];

      for (const rec of recs) {
        const estimatedSpot = getEstimatedSpotPrice(rec.asset_class);
        const estimatedIV = getEstimatedIV(rec.asset_class);
        const dte = 52;

        let strategy: OptionStrategy;

        if (rec.recommendation === 'buy') {
          const putStrike = estimatedSpot * 0.95;
          const premium = calculateOptionPrice(
            estimatedSpot,
            putStrike,
            dte / 365,
            0.045,
            estimatedIV,
            'put'
          ) * 100;
          const buyingPower = calculateBuyingPower('short_put', estimatedSpot, putStrike);

          strategy = {
            recommendation_id: rec.id,
            asset_class: rec.asset_class,
            strategy_type: 'short_put',
            dte,
            spot_price: estimatedSpot,
            implied_volatility: estimatedIV,
            strike_price: putStrike,
            strike_price_put: putStrike,
            strike_price_call: 0,
            premium_collected: premium,
            buying_power_required: buyingPower,
            manual_input: false
          };
        } else {
          const callStrike = estimatedSpot * 1.05;
          const premium = calculateOptionPrice(
            estimatedSpot,
            callStrike,
            dte / 365,
            0.045,
            estimatedIV,
            'call'
          ) * 100;
          const buyingPower = calculateBuyingPower('short_call', estimatedSpot, callStrike);

          strategy = {
            recommendation_id: rec.id,
            asset_class: rec.asset_class,
            strategy_type: 'short_call',
            dte,
            spot_price: estimatedSpot,
            implied_volatility: estimatedIV,
            strike_price: callStrike,
            strike_price_put: 0,
            strike_price_call: callStrike,
            premium_collected: premium,
            buying_power_required: buyingPower,
            manual_input: false
          };
        }

        generatedStrategies.push(strategy);
      }

      const { data: inserted } = await supabase
        .from('options_strategies')
        .insert(generatedStrategies)
        .select();

      if (inserted) {
        setStrategies(inserted);
      }
    } catch (error) {
      console.error('Error generating strategies:', error);
    } finally {
      setGenerating(false);
    }
  };

  const getEstimatedSpotPrice = (assetClass: string): number => {
    const estimates: { [key: string]: number } = {
      'S&P 500 Index': 4500,
      'Technology Stocks': 180,
      'Healthcare Stocks': 150,
      'Financial Stocks': 85,
      'Energy Stocks': 75,
      'Gold': 2000,
      'Silver': 24,
      'Crude Oil': 75,
      'Natural Gas': 3.5,
      'Copper': 4.2,
      'US Treasury Bonds': 110,
      'Corporate Bonds': 105,
      'Real Estate': 95
    };
    return estimates[assetClass] || 100;
  };

  const getEstimatedIV = (assetClass: string): number => {
    const ivEstimates: { [key: string]: number } = {
      'S&P 500 Index': 0.18,
      'Technology Stocks': 0.32,
      'Healthcare Stocks': 0.22,
      'Financial Stocks': 0.25,
      'Energy Stocks': 0.35,
      'Gold': 0.15,
      'Silver': 0.28,
      'Crude Oil': 0.40,
      'Natural Gas': 0.50,
      'Copper': 0.25,
      'US Treasury Bonds': 0.08,
      'Corporate Bonds': 0.12,
      'Real Estate': 0.20
    };
    return ivEstimates[assetClass] || 0.25;
  };

  const startEdit = (strategy: OptionStrategy) => {
    setEditingId(strategy.id || '');
    setEditForm({
      spot_price: strategy.spot_price,
      implied_volatility: strategy.implied_volatility,
      dte: strategy.dte
    });
  };

  const saveEdit = async (strategy: OptionStrategy) => {
    try {
      const updatedSpot = editForm.spot_price || strategy.spot_price;
      const updatedIV = editForm.implied_volatility || strategy.implied_volatility;
      const updatedDTE = editForm.dte || strategy.dte;

      let premium = 0;
      let buyingPower = 0;

      if (strategy.strategy_type === 'short_put') {
        const putStrike = updatedSpot * 0.95;
        premium = calculateOptionPrice(updatedSpot, putStrike, updatedDTE / 365, 0.045, updatedIV, 'put') * 100;
        buyingPower = calculateBuyingPower('short_put', updatedSpot, putStrike);

        await supabase
          .from('options_strategies')
          .update({
            spot_price: updatedSpot,
            implied_volatility: updatedIV,
            dte: updatedDTE,
            strike_price: putStrike,
            strike_price_put: putStrike,
            premium_collected: premium,
            buying_power_required: buyingPower,
            manual_input: true
          })
          .eq('id', strategy.id);
      } else if (strategy.strategy_type === 'short_call') {
        const callStrike = updatedSpot * 1.05;
        premium = calculateOptionPrice(updatedSpot, callStrike, updatedDTE / 365, 0.045, updatedIV, 'call') * 100;
        buyingPower = calculateBuyingPower('short_call', updatedSpot, callStrike);

        await supabase
          .from('options_strategies')
          .update({
            spot_price: updatedSpot,
            implied_volatility: updatedIV,
            dte: updatedDTE,
            strike_price: callStrike,
            strike_price_call: callStrike,
            premium_collected: premium,
            buying_power_required: buyingPower,
            manual_input: true
          })
          .eq('id', strategy.id);
      }

      setEditingId(null);
      loadData();
    } catch (error) {
      console.error('Error updating strategy:', error);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-slate-600">Loading strategies...</div>
      </div>
    );
  }

  const totalPremium = strategies.reduce((sum, s) => sum + s.premium_collected, 0);
  const totalBuyingPower = strategies.reduce((sum, s) => sum + s.buying_power_required, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Options Trading Strategies</h1>
          <p className="text-slate-600">Conservative option selling strategies based on Black-Scholes-Merton model</p>
        </div>

        {generating && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            <p className="text-blue-800">Calculating option strategies using BSM model...</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500">
            <p className="text-sm text-slate-600 mb-1">Total Premium Collected</p>
            <p className="text-3xl font-bold text-green-600">${totalPremium.toFixed(2)}</p>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
            <p className="text-sm text-slate-600 mb-1">Total Buying Power Required</p>
            <p className="text-3xl font-bold text-blue-600">${totalBuyingPower.toFixed(2)}</p>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-orange-500">
            <p className="text-sm text-slate-600 mb-1">Return on Capital</p>
            <p className="text-3xl font-bold text-orange-600">
              {totalBuyingPower > 0 ? ((totalPremium / totalBuyingPower) * 100).toFixed(2) : '0'}%
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left py-4 px-4 font-semibold text-slate-700">Asset Class</th>
                  <th className="text-left py-4 px-4 font-semibold text-slate-700">Strategy</th>
                  <th className="text-center py-4 px-4 font-semibold text-slate-700">DTE</th>
                  <th className="text-center py-4 px-4 font-semibold text-slate-700">Spot Price</th>
                  <th className="text-center py-4 px-4 font-semibold text-slate-700">IV</th>
                  <th className="text-center py-4 px-4 font-semibold text-slate-700">Strike</th>
                  <th className="text-center py-4 px-4 font-semibold text-slate-700">Premium</th>
                  <th className="text-center py-4 px-4 font-semibold text-slate-700">Buying Power</th>
                  <th className="text-center py-4 px-4 font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {strategies.map((strategy) => {
                  const isEditing = editingId === strategy.id;
                  const strikeToShow = strategy.strategy_type === 'short_put'
                    ? strategy.strike_price_put
                    : strategy.strike_price_call;

                  return (
                    <tr key={strategy.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-4 px-4">
                        <div>
                          <p className="font-medium text-slate-900">{strategy.asset_class}</p>
                          {strategy.manual_input && (
                            <span className="text-xs text-blue-600">Manual Data</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          strategy.strategy_type === 'short_put' ? 'bg-green-100 text-green-700' :
                          strategy.strategy_type === 'short_call' ? 'bg-red-100 text-red-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {strategy.strategy_type.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        {isEditing ? (
                          <input
                            type="number"
                            className="w-16 px-2 py-1 border border-slate-300 rounded text-center"
                            value={editForm.dte || strategy.dte}
                            onChange={(e) => setEditForm({ ...editForm, dte: parseInt(e.target.value) })}
                          />
                        ) : (
                          <span className="text-slate-700">{strategy.dte}</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-center">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            className="w-20 px-2 py-1 border border-slate-300 rounded text-center"
                            value={editForm.spot_price || strategy.spot_price}
                            onChange={(e) => setEditForm({ ...editForm, spot_price: parseFloat(e.target.value) })}
                          />
                        ) : (
                          <span className="text-slate-700">${strategy.spot_price.toFixed(2)}</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-center">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            className="w-16 px-2 py-1 border border-slate-300 rounded text-center"
                            value={editForm.implied_volatility || strategy.implied_volatility}
                            onChange={(e) => setEditForm({ ...editForm, implied_volatility: parseFloat(e.target.value) })}
                          />
                        ) : (
                          <span className="text-slate-700">{(strategy.implied_volatility * 100).toFixed(1)}%</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-center text-slate-700">${strikeToShow.toFixed(2)}</td>
                      <td className="py-4 px-4 text-center">
                        <span className="font-semibold text-green-600">${strategy.premium_collected.toFixed(2)}</span>
                      </td>
                      <td className="py-4 px-4 text-center text-slate-700">
                        ${strategy.buying_power_required.toFixed(2)}
                      </td>
                      <td className="py-4 px-4 text-center">
                        {isEditing ? (
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => saveEdit(strategy)}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(strategy)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <DollarSign className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">Strategy Summary</h3>
              <p className="text-blue-800 text-sm mb-3">
                This portfolio implements conservative option selling strategies with 45-60 DTE (Days To Expiration).
                Short puts are used for assets with bullish outlook, while short calls are used for bearish positions.
              </p>
              <div className="space-y-2 text-sm text-blue-700">
                <p>Total Strategies: <span className="font-semibold">{strategies.length}</span></p>
                <p>Estimated Monthly Return: <span className="font-semibold">
                  {totalBuyingPower > 0 ? ((totalPremium / totalBuyingPower) * 100 / 2).toFixed(2) : '0'}%
                </span> (assuming 2-month average hold)</p>
              </div>
              <p className="text-xs text-blue-600 mt-3">
                Click the edit icon to manually update spot price, IV, or DTE for any asset.
                The premium and buying power will be recalculated automatically using the BSM model.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
