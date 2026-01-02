import { calculateOptionPrice, findStrikeForDelta } from './bsm';
import { AssetClassScore, getStrategyType, TRADEABLE_ASSETS, FuturesSpec } from './scoring';

export interface AssetData {
  symbol: string;
  assetClass: string;
  spotPrice: number;
  impliedVolatility: number;
  ivRank: number;
}

export interface OptionStrategy {
  symbol: string;
  assetName: string;
  assetClass: string;
  signal: 'buy' | 'sell' | 'neutral';
  strategyType: 'short_put' | 'short_call' | 'short_strangle';
  numberOfLots: number;
  notionalValue: number;
  dte: number;
  spotPrice: number;
  iv: number;
  strikePricePut?: number;
  strikePriceCall?: number;
  premiumPut?: number;
  premiumCall?: number;
  premiumPerContract: number;
  totalPremium: number;
  buyingPowerRequired: number;
  returnOnCapital: number;
}

const RISK_FREE_RATE = 0.04;
const TARGET_DTE = 52;
const MAX_NOTIONAL_PER_ASSET = 500000;
const MAX_BUYING_POWER_PER_TRADE = 100000;
const TARGET_DELTA = 0.20;

function calculateNumberOfLots(
  spotPrice: number,
  multiplier: number,
  maxNotional: number,
  strategyType: string
): number {
  const notionalPerContract = spotPrice * multiplier;
  const maxLotsFromNotional = Math.floor(maxNotional / notionalPerContract);

  const bpPercentage = strategyType === 'short_strangle' ? 0.25 : 0.20;
  const buyingPowerPerLot = spotPrice * bpPercentage * multiplier;
  const maxLotsFromBuyingPower = Math.floor(MAX_BUYING_POWER_PER_TRADE / buyingPowerPerLot);

  const maxLots = Math.min(maxLotsFromNotional, maxLotsFromBuyingPower);

  if (notionalPerContract > MAX_NOTIONAL_PER_ASSET) {
    console.warn(`Single contract notional (${notionalPerContract.toFixed(0)}) exceeds max notional limit (${MAX_NOTIONAL_PER_ASSET})`);
    return 0;
  }

  if (buyingPowerPerLot > MAX_BUYING_POWER_PER_TRADE) {
    console.warn(`Single contract buying power (${buyingPowerPerLot.toFixed(0)}) exceeds max buying power limit (${MAX_BUYING_POWER_PER_TRADE})`);
    return 0;
  }

  return Math.max(1, maxLots);
}

function calculateBuyingPower(spotPrice: number, strategyType: string, multiplier: number, numberOfLots: number): number {
  if (strategyType === 'short_put') {
    return spotPrice * 0.20 * multiplier * numberOfLots;
  } else if (strategyType === 'short_call') {
    return spotPrice * 0.20 * multiplier * numberOfLots;
  } else {
    return spotPrice * 0.25 * multiplier * numberOfLots;
  }
}

export function generateOptionStrategy(
  assetData: AssetData,
  score: AssetClassScore
): OptionStrategy | null {
  const asset = TRADEABLE_ASSETS.find(a => a.symbol === assetData.symbol);
  if (!asset) return null;

  const strategyType = getStrategyType(score.signal);
  const iv = assetData.impliedVolatility;
  const timeToExpiry = TARGET_DTE / 365;
  const numberOfLots = calculateNumberOfLots(assetData.spotPrice, asset.multiplier, asset.maxNotional, strategyType);

  if (numberOfLots === 0) {
    console.warn(`Skipping ${assetData.symbol}: cannot allocate any lots within constraints`);
    return null;
  }

  const notionalValue = assetData.spotPrice * asset.multiplier * numberOfLots;

  let premiumPerContract = 0;
  let totalPremium = 0;
  let strikePricePut: number | undefined;
  let strikePriceCall: number | undefined;
  let premiumPut: number | undefined;
  let premiumCall: number | undefined;

  if (strategyType === 'short_put') {
    strikePricePut = findStrikeForDelta(
      assetData.spotPrice,
      TARGET_DELTA,
      timeToExpiry,
      RISK_FREE_RATE,
      iv,
      'put'
    );
    premiumPut = calculateOptionPrice(
      assetData.spotPrice,
      strikePricePut,
      timeToExpiry,
      RISK_FREE_RATE,
      iv,
      'put'
    );
    premiumPerContract = premiumPut * asset.multiplier;
    totalPremium = premiumPerContract * numberOfLots;
  } else if (strategyType === 'short_call') {
    strikePriceCall = findStrikeForDelta(
      assetData.spotPrice,
      TARGET_DELTA,
      timeToExpiry,
      RISK_FREE_RATE,
      iv,
      'call'
    );
    premiumCall = calculateOptionPrice(
      assetData.spotPrice,
      strikePriceCall,
      timeToExpiry,
      RISK_FREE_RATE,
      iv,
      'call'
    );
    premiumPerContract = premiumCall * asset.multiplier;
    totalPremium = premiumPerContract * numberOfLots;
  } else {
    strikePricePut = findStrikeForDelta(
      assetData.spotPrice,
      TARGET_DELTA,
      timeToExpiry,
      RISK_FREE_RATE,
      iv,
      'put'
    );
    strikePriceCall = findStrikeForDelta(
      assetData.spotPrice,
      TARGET_DELTA,
      timeToExpiry,
      RISK_FREE_RATE,
      iv,
      'call'
    );

    premiumPut = calculateOptionPrice(
      assetData.spotPrice,
      strikePricePut,
      timeToExpiry,
      RISK_FREE_RATE,
      iv,
      'put'
    );

    premiumCall = calculateOptionPrice(
      assetData.spotPrice,
      strikePriceCall,
      timeToExpiry,
      RISK_FREE_RATE,
      iv,
      'call'
    );

    premiumPerContract = (premiumPut + premiumCall) * asset.multiplier;
    totalPremium = premiumPerContract * numberOfLots;
  }

  const buyingPowerRequired = calculateBuyingPower(assetData.spotPrice, strategyType, asset.multiplier, numberOfLots);
  const returnOnCapital = (totalPremium / buyingPowerRequired) * 100;

  return {
    symbol: assetData.symbol,
    assetName: asset.name,
    assetClass: assetData.assetClass,
    signal: score.signal,
    strategyType,
    numberOfLots,
    notionalValue,
    dte: TARGET_DTE,
    spotPrice: assetData.spotPrice,
    iv,
    strikePricePut,
    strikePriceCall,
    premiumPut: premiumPut ? premiumPut * asset.multiplier * numberOfLots : undefined,
    premiumCall: premiumCall ? premiumCall * asset.multiplier * numberOfLots : undefined,
    premiumPerContract,
    totalPremium,
    buyingPowerRequired,
    returnOnCapital,
  };
}

export function generatePortfolio(
  assetDataList: AssetData[],
  scores: AssetClassScore[]
): OptionStrategy[] {
  const strategies: OptionStrategy[] = [];

  for (const assetData of assetDataList) {
    const score = scores.find(s => s.assetClass === assetData.assetClass);
    if (!score) continue;

    const strategy = generateOptionStrategy(assetData, score);
    if (strategy) {
      strategies.push(strategy);
    }
  }

  return strategies;
}

export function calculatePortfolioMetrics(strategies: OptionStrategy[]) {
  const totalPremium = strategies.reduce((sum, s) => sum + s.totalPremium, 0);
  const totalBuyingPower = strategies.reduce((sum, s) => sum + s.buyingPowerRequired, 0);
  const totalNotional = strategies.reduce((sum, s) => sum + s.notionalValue, 0);
  const avgReturnOnCapital = totalBuyingPower > 0 ? (totalPremium / totalBuyingPower) * 100 : 0;
  const monthlyReturn = totalBuyingPower > 0 ? (totalPremium / totalBuyingPower) * 100 * (30.5 / TARGET_DTE) : 0;

  return {
    totalPremium,
    totalBuyingPower,
    totalNotional,
    avgReturnOnCapital,
    monthlyReturn,
    numberOfTrades: strategies.length,
  };
}
