export interface MacroData {
  businessCycle: string;
  globalLiquidity: string;
  interestRates: Array<{ country: string; direction: string; policy: string }>;
  valuations: Array<{ index: string; level: string }>;
  commodities: Array<{ name: string; bias: string }>;
}

export interface AssetClassScore {
  assetClass: string;
  businessCycleScore: number;
  liquidityScore: number;
  interestRateScore: number;
  valuationScore: number;
  commodityScore: number;
  totalScore: number;
  signal: 'buy' | 'sell' | 'neutral';
}

const ASSET_CLASSES = [
  { name: 'Equity Indices', symbols: ['ES', 'NQ'] },
  { name: 'Precious Metals', symbols: ['GC', 'SI'] },
  { name: 'Energy', symbols: ['CL', 'NG'] },
  { name: 'Industrial Metals', symbols: ['HG'] },
  { name: 'Agriculture', symbols: ['ZW'] },
  { name: 'Cryptocurrency', symbols: ['MBT'] },
];

function getBusinessCycleScore(cycle: string, assetClass: string): number {
  const cycleMap: Record<string, number> = {
    'expansion': 2,
    'peak': 1,
    'contraction': -2,
    'trough': -1,
  };

  const baseScore = cycleMap[cycle.toLowerCase()] || 0;

  if (assetClass === 'Equity Indices') {
    return baseScore;
  } else if (assetClass === 'Fixed Income') {
    return -baseScore;
  } else if (assetClass === 'Precious Metals') {
    return baseScore < 0 ? -baseScore * 0.5 : baseScore * 0.5;
  }

  return baseScore * 0.8;
}

function getLiquidityScore(liquidity: string, assetClass: string): number {
  const liquidityMap: Record<string, number> = {
    'abundant': 3,
    'adequate': 1,
    'tight': -2,
    'crisis': -3,
  };

  const baseScore = liquidityMap[liquidity.toLowerCase()] || 0;

  if (assetClass === 'Precious Metals' && baseScore < 0) {
    return Math.abs(baseScore);
  }

  if (assetClass === 'Cryptocurrency') {
    return baseScore * 1.5;
  }

  return baseScore;
}

function getInterestRateScore(rates: Array<{ country: string; direction: string; policy: string }>, assetClass: string): number {
  const usRate = rates.find(r => r.country === 'USA');
  if (!usRate) return 0;

  let score = 0;

  if (usRate.direction === 'falling' || usRate.policy === 'QE') {
    score = 2;
  } else if (usRate.direction === 'rising' || usRate.policy === 'QT') {
    score = -2;
  } else {
    score = 0;
  }

  if (assetClass === 'Fixed Income') {
    return -score;
  } else if (assetClass === 'Equity Indices') {
    return score;
  } else if (assetClass === 'Precious Metals') {
    return score * 1.2;
  }

  return score * 0.7;
}

function getValuationScore(valuations: Array<{ index: string; level: string }>, assetClass: string): number {
  if (assetClass !== 'Equity Indices') return 0;

  const spValuation = valuations.find(v => v.index === 'S&P 500');
  if (!spValuation) return 0;

  const valuationMap: Record<string, number> = {
    'cheap': 2,
    'fair': 0,
    'expensive': -2,
  };

  return valuationMap[spValuation.level.toLowerCase()] || 0;
}

function getCommodityScore(commodities: Array<{ name: string; bias: string }>, assetClass: string): number {
  const assetCommodityMap: Record<string, string[]> = {
    'Precious Metals': ['Gold', 'Silver'],
    'Energy': ['Crude Oil', 'Natural Gas'],
    'Industrial Metals': ['Copper'],
    'Agriculture': ['Wheat'],
  };

  const relevantCommodities = assetCommodityMap[assetClass];
  if (!relevantCommodities) return 0;

  const biasMap: Record<string, number> = {
    'bullish': 2,
    'neutral': 0,
    'bearish': -2,
  };

  let totalScore = 0;
  let count = 0;

  for (const commName of relevantCommodities) {
    const comm = commodities.find(c => c.name === commName);
    if (comm) {
      totalScore += biasMap[comm.bias.toLowerCase()] || 0;
      count++;
    }
  }

  return count > 0 ? totalScore / count : 0;
}

function determineSignal(totalScore: number): 'buy' | 'sell' | 'neutral' {
  if (totalScore >= 5) return 'buy';
  if (totalScore <= -5) return 'sell';
  return 'neutral';
}

export function calculateAssetClassScores(macroData: MacroData): AssetClassScore[] {
  return ASSET_CLASSES.map(asset => {
    const businessCycleScore = getBusinessCycleScore(macroData.businessCycle, asset.name);
    const liquidityScore = getLiquidityScore(macroData.globalLiquidity, asset.name);
    const interestRateScore = getInterestRateScore(macroData.interestRates, asset.name);
    const valuationScore = getValuationScore(macroData.valuations, asset.name);
    const commodityScore = getCommodityScore(macroData.commodities, asset.name);

    const totalScore = businessCycleScore + liquidityScore + interestRateScore + valuationScore + commodityScore;
    const signal = determineSignal(totalScore);

    return {
      assetClass: asset.name,
      businessCycleScore: Math.round(businessCycleScore * 10) / 10,
      liquidityScore: Math.round(liquidityScore * 10) / 10,
      interestRateScore: Math.round(interestRateScore * 10) / 10,
      valuationScore: Math.round(valuationScore * 10) / 10,
      commodityScore: Math.round(commodityScore * 10) / 10,
      totalScore: Math.round(totalScore * 10) / 10,
      signal,
    };
  });
}

export function getStrategyType(signal: 'buy' | 'sell' | 'neutral'): 'short_put' | 'short_call' | 'short_strangle' {
  if (signal === 'buy') return 'short_put';
  if (signal === 'sell') return 'short_call';
  return 'short_strangle';
}

export interface FuturesSpec {
  symbol: string;
  name: string;
  assetClass: string;
  multiplier: number;
  tickSize: number;
  tickValue: number;
  contractSize: string;
  exchange: string;
  maxNotional: number;
}

export const TRADEABLE_ASSETS: FuturesSpec[] = [
  {
    symbol: 'ES',
    name: 'E-mini S&P 500',
    assetClass: 'Equity Indices',
    multiplier: 50,
    tickSize: 0.25,
    tickValue: 12.50,
    contractSize: '$50 × S&P 500 Index',
    exchange: 'CME',
    maxNotional: 500000
  },
  {
    symbol: 'NQ',
    name: 'E-mini Nasdaq',
    assetClass: 'Equity Indices',
    multiplier: 20,
    tickSize: 0.25,
    tickValue: 5.00,
    contractSize: '$20 × Nasdaq-100 Index',
    exchange: 'CME',
    maxNotional: 500000
  },
  {
    symbol: 'GC',
    name: 'Gold Futures',
    assetClass: 'Precious Metals',
    multiplier: 100,
    tickSize: 0.10,
    tickValue: 10.00,
    contractSize: '100 troy oz',
    exchange: 'COMEX',
    maxNotional: 500000
  },
  {
    symbol: 'SI',
    name: 'Silver Futures',
    assetClass: 'Precious Metals',
    multiplier: 5000,
    tickSize: 0.005,
    tickValue: 25.00,
    contractSize: '5,000 troy oz',
    exchange: 'COMEX',
    maxNotional: 500000
  },
  {
    symbol: 'CL',
    name: 'Crude Oil',
    assetClass: 'Energy',
    multiplier: 1000,
    tickSize: 0.01,
    tickValue: 10.00,
    contractSize: '1,000 barrels',
    exchange: 'NYMEX',
    maxNotional: 500000
  },
  {
    symbol: 'NG',
    name: 'Natural Gas',
    assetClass: 'Energy',
    multiplier: 10000,
    tickSize: 0.001,
    tickValue: 10.00,
    contractSize: '10,000 MMBtu',
    exchange: 'NYMEX',
    maxNotional: 500000
  },
  {
    symbol: 'HG',
    name: 'Copper Futures',
    assetClass: 'Industrial Metals',
    multiplier: 25000,
    tickSize: 0.0005,
    tickValue: 12.50,
    contractSize: '25,000 lbs',
    exchange: 'COMEX',
    maxNotional: 500000
  },
  {
    symbol: 'ZW',
    name: 'Wheat Futures',
    assetClass: 'Agriculture',
    multiplier: 5000,
    tickSize: 0.0025,
    tickValue: 12.50,
    contractSize: '5,000 bushels',
    exchange: 'CBOT',
    maxNotional: 500000
  },
  {
    symbol: 'MBT',
    name: 'Micro Bitcoin Futures',
    assetClass: 'Cryptocurrency',
    multiplier: 0.1,
    tickSize: 5.00,
    tickValue: 0.50,
    contractSize: '0.1 BTC',
    exchange: 'CME',
    maxNotional: 500000
  },
];
