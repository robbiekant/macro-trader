import { useState, useEffect } from 'react';
import { TrendingUp, Save, ArrowLeft, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { TRADEABLE_ASSETS } from '../lib/scoring';

interface AssetDataInput {
  symbol: string;
  name: string;
  assetClass: string;
  spotPrice: string;
  impliedVolatility: string;
  ivRank: string;
}

interface AssetDataPageProps {
  snapshotId: string;
  onBack: () => void;
  onComplete: () => void;
}

export default function AssetDataPage({ snapshotId, onBack, onComplete }: AssetDataPageProps) {
  const [assetData, setAssetData] = useState<AssetDataInput[]>(
    TRADEABLE_ASSETS.map(asset => ({
      symbol: asset.symbol,
      name: asset.name,
      assetClass: asset.assetClass,
      spotPrice: '',
      impliedVolatility: '0.25',
      ivRank: '50',
    }))
  );
  const [loading, setLoading] = useState(false);
  const [fetchingAI, setFetchingAI] = useState(false);
  const [error, setError] = useState('');
  const [loadingExisting, setLoadingExisting] = useState(true);

  useEffect(() => {
    loadExistingData();
  }, [snapshotId]);

  async function loadExistingData() {
    try {
      const { data, error } = await supabase
        .from('asset_data')
        .select('*')
        .eq('snapshot_id', snapshotId);

      if (error) throw error;

      if (data && data.length > 0) {
        setAssetData(prev =>
          prev.map(asset => {
            const existing = data.find(d => d.symbol === asset.symbol);
            if (existing) {
              return {
                ...asset,
                spotPrice: existing.spot_price.toString(),
                impliedVolatility: existing.implied_volatility?.toString() || '0.25',
                ivRank: existing.iv_rank.toString(),
              };
            }
            return asset;
          })
        );
      }
    } catch (err) {
      console.error('Error loading existing asset data:', err);
    } finally {
      setLoadingExisting(false);
    }
  }

  async function handleFetchAIData() {
    setFetchingAI(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-market-data`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to fetch market data');

      const result = await response.json();

      if (result.success && result.data) {
        setAssetData(prev =>
          prev.map(asset => {
            const aiData = result.data.find((d: any) => d.symbol === asset.symbol);
            if (aiData) {
              return {
                ...asset,
                spotPrice: aiData.spotPrice.toString(),
                impliedVolatility: aiData.impliedVolatility.toString(),
                ivRank: aiData.ivRank.toString(),
              };
            }
            return asset;
          })
        );
      }
    } catch (err: any) {
      console.error('Error fetching AI data:', err);
      setError(err.message || 'Failed to fetch market data');
    } finally {
      setFetchingAI(false);
    }
  }

  function handleInputChange(symbol: string, field: 'spotPrice' | 'impliedVolatility' | 'ivRank', value: string) {
    setAssetData(prev =>
      prev.map(asset =>
        asset.symbol === symbol ? { ...asset, [field]: value } : asset
      )
    );
  }

  async function handleSave() {
    setError('');

    const hasEmptySpot = assetData.some(asset => !asset.spotPrice || parseFloat(asset.spotPrice) <= 0);
    if (hasEmptySpot) {
      setError('Please enter valid spot prices for all assets');
      return;
    }

    const hasInvalidIV = assetData.some(asset => {
      const iv = parseFloat(asset.impliedVolatility);
      return isNaN(iv) || iv <= 0 || iv > 2;
    });
    if (hasInvalidIV) {
      setError('Implied Volatility must be between 0 and 2 (e.g., 0.25 for 25%)');
      return;
    }

    const hasInvalidIVRank = assetData.some(asset => {
      const ivRank = parseFloat(asset.ivRank);
      return isNaN(ivRank) || ivRank < 0 || ivRank > 100;
    });
    if (hasInvalidIVRank) {
      setError('IV Rank must be between 0 and 100');
      return;
    }

    setLoading(true);

    try {
      const { error: deleteError } = await supabase
        .from('asset_data')
        .delete()
        .eq('snapshot_id', snapshotId);

      if (deleteError) throw deleteError;

      const insertData = assetData.map(asset => ({
        snapshot_id: snapshotId,
        symbol: asset.symbol,
        asset_name: asset.name,
        asset_class: asset.assetClass,
        spot_price: parseFloat(asset.spotPrice),
        implied_volatility: parseFloat(asset.impliedVolatility),
        iv_rank: parseFloat(asset.ivRank),
        manual_override: true,
      }));

      const { error: insertError } = await supabase
        .from('asset_data')
        .insert(insertData);

      if (insertError) throw insertError;

      onComplete();
    } catch (err: any) {
      console.error('Error saving asset data:', err);
      setError(err.message || 'Failed to save asset data');
    } finally {
      setLoading(false);
    }
  }

  if (loadingExisting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto"></div>
          <p className="mt-4 text-slate-400">Loading asset data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-8 shadow-2xl border border-slate-700">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-blue-400" />
              <div>
                <h1 className="text-3xl font-bold">Asset Data Input</h1>
                <p className="text-slate-400 mt-1">Enter spot prices, IV, and IV rank for each tradeable asset</p>
              </div>
            </div>
            <button
              onClick={handleFetchAIData}
              disabled={fetchingAI}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:from-slate-600 disabled:to-slate-700 text-white rounded-lg font-medium transition-all"
            >
              <Sparkles className="w-5 h-5" />
              {fetchingAI ? 'Fetching...' : 'Fetch AI Data'}
            </button>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 mb-6">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          <div className="bg-blue-500/10 border border-blue-500/50 rounded-lg p-4 mb-6">
            <h3 className="text-blue-300 font-semibold mb-2">Price Format Guide</h3>
            <ul className="text-blue-200 text-sm space-y-1">
              <li>• <strong>Equity Indices (ES, NQ):</strong> Enter index value (e.g., 5800 for ES at 5800 points)</li>
              <li>• <strong>Commodities (GC, SI, CL, NG, HG):</strong> Enter price per unit in dollars (e.g., 2650 for gold at $2,650/oz)</li>
              <li>• <strong>Wheat (ZW):</strong> Enter price in dollars per bushel (e.g., 5.50 for $5.50/bushel, NOT 550 cents)</li>
              <li>• <strong>Bitcoin (MBT):</strong> Enter BTC price in dollars (e.g., 95000 for Bitcoin at $95,000)</li>
            </ul>
            <p className="text-blue-300 text-xs mt-2">Note: Trades with notional &gt; $500K or buying power &gt; $100K per contract will be skipped automatically.</p>
          </div>

          <div className="space-y-6">
            {TRADEABLE_ASSETS.map(asset => {
              const data = assetData.find(a => a.symbol === asset.symbol);
              if (!data) return null;

              return (
                <div key={asset.symbol} className="bg-slate-900/50 rounded-lg p-6 border border-slate-700">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-1">{asset.symbol}</h3>
                      <p className="text-sm text-slate-400 mb-2">{asset.name}</p>
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-block px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs">
                          {asset.assetClass}
                        </span>
                        <span className="inline-block px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-xs font-medium">
                          Lot: {asset.contractSize}
                        </span>
                        <span className="inline-block px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">
                          Multiplier: {asset.multiplier}x
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Spot Price
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={data.spotPrice}
                          onChange={(e) => handleInputChange(asset.symbol, 'spotPrice', e.target.value)}
                          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="0.00"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          IV (0.0-1.0)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="2"
                          step="0.01"
                          value={data.impliedVolatility}
                          onChange={(e) => handleInputChange(asset.symbol, 'impliedVolatility', e.target.value)}
                          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="0.25"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          IV Rank (0-100)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={data.ivRank}
                          onChange={(e) => handleInputChange(asset.symbol, 'ivRank', e.target.value)}
                          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="50"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex gap-4">
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-slate-600 disabled:to-slate-700 text-white px-6 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />
              {loading ? 'Saving...' : 'Save & Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
