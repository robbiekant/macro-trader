import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, ChevronRight, BarChart3, Globe, DollarSign } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface DashboardData {
  snapshot: {
    id: string;
    business_cycle: string;
    economic_cycle: string;
    global_liquidity: string;
    macro_outlook: string;
    created_at: string;
  };
  interestRates: Array<{
    country: string;
    current_rate: number;
    direction: string;
    policy_stance: string;
  }>;
  marketValuations: Array<{
    index_name: string;
    pe_ratio: number;
    valuation_level: string;
  }>;
  commodities: Array<{
    commodity: string;
    supply_outlook: string;
    demand_outlook: string;
    fundamental_bias: string;
  }>;
}

interface Props {
  snapshotId: string;
  onAnalyze: () => void;
}

export default function DashboardPage({ snapshotId, onAnalyze }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [snapshotId]);

  const loadData = async () => {
    try {
      const { data: snapshot, error: snapshotError } = await supabase
        .from('macro_snapshots')
        .select('*')
        .eq('id', snapshotId)
        .single();

      if (snapshotError) throw snapshotError;

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

      setData({
        snapshot,
        interestRates: interestRates || [],
        marketValuations: marketValuations || [],
        commodities: commodities || []
      });
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  if (!data) return null;

  const getDirectionIcon = (direction: string) => {
    if (direction === 'rising') return <TrendingUp className="w-4 h-4 text-red-600" />;
    if (direction === 'falling') return <TrendingDown className="w-4 h-4 text-green-600" />;
    return <div className="w-4 h-4 text-slate-400">→</div>;
  };

  const getValuationColor = (level: string) => {
    if (level === 'expensive') return 'text-red-600 bg-red-50';
    if (level === 'cheap') return 'text-green-600 bg-green-50';
    return 'text-slate-600 bg-slate-50';
  };

  const getBiasColor = (bias: string) => {
    if (bias === 'bullish') return 'text-green-600 bg-green-50';
    if (bias === 'bearish') return 'text-red-600 bg-red-50';
    return 'text-slate-600 bg-slate-50';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Macro Economic Dashboard</h1>
          <p className="text-slate-600">
            Analysis snapshot from {new Date(data.snapshot.created_at).toLocaleDateString()}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <BarChart3 className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="font-semibold text-slate-700">Business Cycle</h3>
            </div>
            <p className="text-2xl font-bold text-slate-900 capitalize">{data.snapshot.business_cycle}</p>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Globe className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="font-semibold text-slate-700">Global Liquidity</h3>
            </div>
            <p className="text-2xl font-bold text-slate-900 capitalize">{data.snapshot.global_liquidity}</p>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 md:col-span-2">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-orange-600" />
              </div>
              <h3 className="font-semibold text-slate-700">Economic Outlook</h3>
            </div>
            <p className="text-slate-700">{data.snapshot.economic_cycle}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Interest Rates & Monetary Policy</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-2 text-sm font-medium text-slate-600">Country</th>
                    <th className="text-center py-2 px-2 text-sm font-medium text-slate-600">Rate</th>
                    <th className="text-center py-2 px-2 text-sm font-medium text-slate-600">Trend</th>
                    <th className="text-left py-2 px-2 text-sm font-medium text-slate-600">Policy</th>
                  </tr>
                </thead>
                <tbody>
                  {data.interestRates.map((rate) => (
                    <tr key={rate.country} className="border-b border-slate-100">
                      <td className="py-3 px-2 font-medium text-slate-800">{rate.country}</td>
                      <td className="py-3 px-2 text-center text-slate-700">{rate.current_rate}%</td>
                      <td className="py-3 px-2 flex justify-center">
                        {getDirectionIcon(rate.direction)}
                      </td>
                      <td className="py-3 px-2">
                        <span className="text-xs px-2 py-1 bg-slate-100 text-slate-700 rounded-full">
                          {rate.policy_stance}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Market Valuations</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {data.marketValuations.map((valuation) => (
                <div key={valuation.index_name} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-800">{valuation.index_name}</p>
                    <p className="text-sm text-slate-600">P/E: {valuation.pe_ratio}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${getValuationColor(valuation.valuation_level)}`}>
                    {valuation.valuation_level}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Commodity Fundamentals</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Commodity</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Supply</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Demand</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600">Bias</th>
                </tr>
              </thead>
              <tbody>
                {data.commodities.map((commodity) => (
                  <tr key={commodity.commodity} className="border-b border-slate-100">
                    <td className="py-3 px-4 font-medium text-slate-800">{commodity.commodity}</td>
                    <td className="py-3 px-4">
                      <span className="text-sm px-2 py-1 bg-slate-100 text-slate-700 rounded capitalize">
                        {commodity.supply_outlook}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm px-2 py-1 bg-slate-100 text-slate-700 rounded capitalize">
                        {commodity.demand_outlook}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${getBiasColor(commodity.fundamental_bias)}`}>
                        {commodity.fundamental_bias}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-3">Macro Outlook Summary</h2>
          <p className="text-slate-700 mb-6">{data.snapshot.macro_outlook}</p>

          <button
            onClick={onAnalyze}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-semibold"
          >
            Generate AI Investment Recommendations
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
