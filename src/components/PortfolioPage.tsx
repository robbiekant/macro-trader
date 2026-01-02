import { useState, useEffect } from 'react';
import { ArrowLeft, TrendingUp, TrendingDown, Minus, DollarSign, Target, BarChart3 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { calculateAssetClassScores, AssetClassScore } from '../lib/scoring';
import { generatePortfolio, calculatePortfolioMetrics, OptionStrategy, AssetData } from '../lib/portfolio';

interface PortfolioPageProps {
  snapshotId: string;
  onBack: () => void;
}

export default function PortfolioPage({ snapshotId, onBack }: PortfolioPageProps) {
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState<AssetClassScore[]>([]);
  const [portfolio, setPortfolio] = useState<OptionStrategy[]>([]);
  const [portfolioMetrics, setPortfolioMetrics] = useState({
    totalPremium: 0,
    totalBuyingPower: 0,
    totalNotional: 0,
    avgReturnOnCapital: 0,
    monthlyReturn: 0,
    numberOfTrades: 0,
  });
  const [error, setError] = useState('');

  useEffect(() => {
    generateAnalysis();
  }, [snapshotId]);

  async function generateAnalysis() {
    setLoading(true);
    setError('');

    try {
      const { data: snapshot, error: snapshotError } = await supabase
        .from('macro_snapshots')
        .select('*')
        .eq('id', snapshotId)
        .single();

      if (snapshotError) throw snapshotError;

      const { data: rates, error: ratesError } = await supabase
        .from('interest_rates')
        .select('*')
        .eq('snapshot_id', snapshotId);

      if (ratesError) throw ratesError;

      const { data: valuations, error: valuationsError } = await supabase
        .from('market_valuations')
        .select('*')
        .eq('snapshot_id', snapshotId);

      if (valuationsError) throw valuationsError;

      const { data: commodities, error: commoditiesError } = await supabase
        .from('commodity_fundamentals')
        .select('*')
        .eq('snapshot_id', snapshotId);

      if (commoditiesError) throw commoditiesError;

      const { data: assetDataList, error: assetDataError } = await supabase
        .from('asset_data')
        .select('*')
        .eq('snapshot_id', snapshotId);

      if (assetDataError) throw assetDataError;

      if (!assetDataList || assetDataList.length === 0) {
        setError('Please enter asset data first');
        setLoading(false);
        return;
      }

      const { data: existingRecommendations, error: recError } = await supabase
        .from('ai_recommendations')
        .select('*')
        .eq('snapshot_id', snapshotId);

      if (recError) throw recError;

      const macroData = {
        businessCycle: snapshot.business_cycle,
        globalLiquidity: snapshot.global_liquidity,
        interestRates: rates.map(r => ({
          country: r.country,
          direction: r.direction,
          policy: r.policy_stance,
        })),
        valuations: valuations.map(v => ({
          index: v.index_name,
          level: v.valuation_level,
        })),
        commodities: commodities.map(c => ({
          name: c.commodity,
          bias: c.fundamental_bias,
        })),
      };

      const calculatedScores = calculateAssetClassScores(macroData);

      const scoresWithHighConviction = calculatedScores.map(score => {
        const aiRec = existingRecommendations?.find(rec =>
          rec.asset_class.toLowerCase().includes(score.assetClass.toLowerCase()) ||
          score.assetClass.toLowerCase().includes(rec.asset_class.toLowerCase())
        );

        if (aiRec && aiRec.conviction_level === 'high') {
          return {
            ...score,
            signal: aiRec.recommendation,
            totalScore: aiRec.recommendation === 'buy' ? 10 : aiRec.recommendation === 'sell' ? -10 : 0
          };
        }
        return score;
      });

      setScores(scoresWithHighConviction);

      const assetData: AssetData[] = assetDataList.map(a => ({
        symbol: a.symbol,
        assetClass: a.asset_class,
        spotPrice: Number(a.spot_price),
        impliedVolatility: Number(a.implied_volatility || 0.25),
        ivRank: Number(a.iv_rank),
      }));

      const generatedPortfolio = generatePortfolio(assetData, scoresWithHighConviction);
      setPortfolio(generatedPortfolio);

      const metrics = calculatePortfolioMetrics(generatedPortfolio);
      setPortfolioMetrics(metrics);

      await saveToDatabase(scoresWithHighConviction, generatedPortfolio, existingRecommendations);

    } catch (err: any) {
      console.error('Error generating analysis:', err);
      setError(err.message || 'Failed to generate analysis');
    } finally {
      setLoading(false);
    }
  }

  async function saveToDatabase(scores: AssetClassScore[], strategies: OptionStrategy[], existingRecommendations: any[]) {
    try {
      await supabase.from('signal_scores').delete().eq('snapshot_id', snapshotId);

      const scoresData = scores.map(s => ({
        snapshot_id: snapshotId,
        asset_class: s.assetClass,
        business_cycle_score: s.businessCycleScore,
        liquidity_score: s.liquidityScore,
        interest_rate_score: s.interestRateScore,
        valuation_score: s.valuationScore,
        commodity_score: s.commodityScore,
        total_score: s.totalScore,
        signal: s.signal,
      }));

      await supabase.from('signal_scores').insert(scoresData);

      const recIds = existingRecommendations?.map(r => r.id) || [];
      if (recIds.length > 0) {
        await supabase.from('options_strategies').delete().in('recommendation_id', recIds);
      }

      for (const strategy of strategies) {
        const aiRec = existingRecommendations?.find(rec =>
          rec.asset_class.toLowerCase().includes(strategy.assetClass.toLowerCase()) ||
          strategy.assetClass.toLowerCase().includes(rec.asset_class.toLowerCase())
        );

        const recommendationId = aiRec?.id;

        if (recommendationId) {
          await supabase.from('options_strategies').insert({
            recommendation_id: recommendationId,
            asset_class: strategy.assetClass,
            strategy_type: strategy.strategyType,
            dte: strategy.dte,
            spot_price: strategy.spotPrice,
            implied_volatility: strategy.iv,
            strike_price: strategy.strikePricePut || strategy.strikePriceCall || 0,
            strike_price_put: strategy.strikePricePut || 0,
            strike_price_call: strategy.strikePriceCall || 0,
            premium_collected: strategy.totalPremium,
            buying_power_required: strategy.buyingPowerRequired,
            manual_input: true,
          });
        }
      }
    } catch (err) {
      console.error('Error saving to database:', err);
    }
  }

  function getSignalIcon(signal: string) {
    if (signal === 'buy') return <TrendingUp className="w-5 h-5 text-green-400" />;
    if (signal === 'sell') return <TrendingDown className="w-5 h-5 text-red-400" />;
    return <Minus className="w-5 h-5 text-yellow-400" />;
  }

  function getSignalColor(signal: string) {
    if (signal === 'buy') return 'text-green-400';
    if (signal === 'sell') return 'text-red-400';
    return 'text-yellow-400';
  }

  function getStrategyLabel(strategyType: string) {
    if (strategyType === 'short_put') return 'Sell PUT';
    if (strategyType === 'short_call') return 'Sell CALL';
    return 'Sell STRANGLE';
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto"></div>
          <p className="mt-4 text-slate-400">Generating portfolio analysis...</p>
        </div>
      </div>
    );
  }

  if (error) {
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
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-6">
            <p className="text-red-400">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Dashboard
        </button>

        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Options Selling Portfolio</h1>
          <p className="text-slate-400">Based on weighted macro analysis and signal generation</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-6 h-6 text-green-400" />
              <p className="text-slate-400 text-sm">Total Premium</p>
            </div>
            <p className="text-2xl font-bold">${portfolioMetrics.totalPremium.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <Target className="w-6 h-6 text-blue-400" />
              <p className="text-slate-400 text-sm">Buying Power</p>
            </div>
            <p className="text-2xl font-bold">${portfolioMetrics.totalBuyingPower.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="w-6 h-6 text-orange-400" />
              <p className="text-slate-400 text-sm">Total Notional</p>
            </div>
            <p className="text-2xl font-bold">${portfolioMetrics.totalNotional.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="w-6 h-6 text-purple-400" />
              <p className="text-slate-400 text-sm">Avg ROC (52 days)</p>
            </div>
            <p className="text-2xl font-bold">{portfolioMetrics.avgReturnOnCapital.toFixed(2)}%</p>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-6 h-6 text-yellow-400" />
              <p className="text-slate-400 text-sm">Monthly Return</p>
            </div>
            <p className="text-2xl font-bold">{portfolioMetrics.monthlyReturn.toFixed(2)}%</p>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-6 h-6 text-cyan-400" />
              <p className="text-slate-400 text-sm">Total Trades</p>
            </div>
            <p className="text-2xl font-bold">{portfolioMetrics.numberOfTrades}</p>
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-8 shadow-2xl border border-slate-700 mb-8">
          <h2 className="text-2xl font-bold mb-6">Weighted Signal Scores</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Asset Class</th>
                  <th className="text-center py-3 px-4 text-slate-400 font-medium">Business Cycle</th>
                  <th className="text-center py-3 px-4 text-slate-400 font-medium">Liquidity</th>
                  <th className="text-center py-3 px-4 text-slate-400 font-medium">Interest Rate</th>
                  <th className="text-center py-3 px-4 text-slate-400 font-medium">Valuation</th>
                  <th className="text-center py-3 px-4 text-slate-400 font-medium">Commodity</th>
                  <th className="text-center py-3 px-4 text-slate-400 font-medium">Total Score</th>
                  <th className="text-center py-3 px-4 text-slate-400 font-medium">Signal</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((score) => (
                  <tr key={score.assetClass} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                    <td className="py-4 px-4 font-medium">{score.assetClass}</td>
                    <td className="py-4 px-4 text-center">{score.businessCycleScore}</td>
                    <td className="py-4 px-4 text-center">{score.liquidityScore}</td>
                    <td className="py-4 px-4 text-center">{score.interestRateScore}</td>
                    <td className="py-4 px-4 text-center">{score.valuationScore}</td>
                    <td className="py-4 px-4 text-center">{score.commodityScore}</td>
                    <td className="py-4 px-4 text-center font-bold">{score.totalScore}</td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-center gap-2">
                        {getSignalIcon(score.signal)}
                        <span className={`font-semibold uppercase ${getSignalColor(score.signal)}`}>
                          {score.signal}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-8 shadow-2xl border border-slate-700">
          <h2 className="text-2xl font-bold mb-6">Option Selling Portfolio</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-slate-700">
                  <th className="text-left py-3 px-3 text-slate-400 font-medium">Symbol</th>
                  <th className="text-left py-3 px-3 text-slate-400 font-medium">Asset</th>
                  <th className="text-center py-3 px-3 text-slate-400 font-medium">Signal</th>
                  <th className="text-center py-3 px-3 text-slate-400 font-medium">Strategy</th>
                  <th className="text-right py-3 px-3 text-slate-400 font-medium">DTE</th>
                  <th className="text-right py-3 px-3 text-slate-400 font-medium">Lots</th>
                  <th className="text-right py-3 px-3 text-slate-400 font-medium">Notional</th>
                  <th className="text-right py-3 px-3 text-slate-400 font-medium">PUT Strike</th>
                  <th className="text-right py-3 px-3 text-slate-400 font-medium">CALL Strike</th>
                  <th className="text-right py-3 px-3 text-slate-400 font-medium">Premium/Contract</th>
                  <th className="text-right py-3 px-3 text-slate-400 font-medium">Total Premium</th>
                  <th className="text-right py-3 px-3 text-slate-400 font-medium">Buying Power</th>
                  <th className="text-right py-3 px-3 text-slate-400 font-medium">ROC %</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.map((strategy) => (
                  <tr key={strategy.symbol} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                    <td className="py-4 px-3 font-bold text-blue-400">{strategy.symbol}</td>
                    <td className="py-4 px-3">{strategy.assetName}</td>
                    <td className="py-4 px-3">
                      <div className="flex items-center justify-center gap-1">
                        {getSignalIcon(strategy.signal)}
                        <span className={`text-xs font-semibold uppercase ${getSignalColor(strategy.signal)}`}>
                          {strategy.signal}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-3 text-center text-xs">{getStrategyLabel(strategy.strategyType)}</td>
                    <td className="py-4 px-3 text-right font-semibold">{strategy.dte}</td>
                    <td className="py-4 px-3 text-right font-semibold">{strategy.numberOfLots}</td>
                    <td className="py-4 px-3 text-right">${strategy.notionalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                    <td className="py-4 px-3 text-right">{strategy.strikePricePut ? `$${strategy.strikePricePut.toFixed(2)}` : '-'}</td>
                    <td className="py-4 px-3 text-right">{strategy.strikePriceCall ? `$${strategy.strikePriceCall.toFixed(2)}` : '-'}</td>
                    <td className="py-4 px-3 text-right text-green-400 font-semibold">${strategy.premiumPerContract.toFixed(2)}</td>
                    <td className="py-4 px-3 text-right text-green-400 font-bold">${strategy.totalPremium.toFixed(2)}</td>
                    <td className="py-4 px-3 text-right">${strategy.buyingPowerRequired.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                    <td className="py-4 px-3 text-right font-semibold text-blue-400">{strategy.returnOnCapital.toFixed(2)}%</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-600 bg-slate-700/30 font-bold">
                  <td colSpan={10} className="py-4 px-3 text-right text-lg">TOTALS:</td>
                  <td className="py-4 px-3 text-right text-green-400 text-lg">${portfolioMetrics.totalPremium.toFixed(2)}</td>
                  <td className="py-4 px-3 text-right text-lg">${portfolioMetrics.totalBuyingPower.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                  <td className="py-4 px-3 text-right text-blue-400 text-lg">{portfolioMetrics.avgReturnOnCapital.toFixed(2)}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
