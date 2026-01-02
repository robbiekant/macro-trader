function normalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - prob : prob;
}

export function calculateOptionPrice(
  spotPrice: number,
  strikePrice: number,
  timeToExpiry: number,
  riskFreeRate: number,
  volatility: number,
  optionType: 'call' | 'put'
): number {
  const d1 = (Math.log(spotPrice / strikePrice) + (riskFreeRate + (volatility ** 2) / 2) * timeToExpiry) / (volatility * Math.sqrt(timeToExpiry));
  const d2 = d1 - volatility * Math.sqrt(timeToExpiry);

  if (optionType === 'call') {
    return spotPrice * normalCDF(d1) - strikePrice * Math.exp(-riskFreeRate * timeToExpiry) * normalCDF(d2);
  } else {
    return strikePrice * Math.exp(-riskFreeRate * timeToExpiry) * normalCDF(-d2) - spotPrice * normalCDF(-d1);
  }
}

export function calculateStranglePremium(
  spotPrice: number,
  putStrike: number,
  callStrike: number,
  dte: number,
  volatility: number,
  riskFreeRate: number = 0.045
): number {
  const timeToExpiry = dte / 365;

  const putPremium = calculateOptionPrice(spotPrice, putStrike, timeToExpiry, riskFreeRate, volatility, 'put');
  const callPremium = calculateOptionPrice(spotPrice, callStrike, timeToExpiry, riskFreeRate, volatility, 'call');

  return putPremium + callPremium;
}

export function calculateDelta(
  spotPrice: number,
  strikePrice: number,
  timeToExpiry: number,
  riskFreeRate: number,
  volatility: number,
  optionType: 'call' | 'put'
): number {
  const d1 = (Math.log(spotPrice / strikePrice) + (riskFreeRate + (volatility ** 2) / 2) * timeToExpiry) / (volatility * Math.sqrt(timeToExpiry));

  if (optionType === 'call') {
    return normalCDF(d1);
  } else {
    return normalCDF(d1) - 1;
  }
}

export function findStrikeForDelta(
  spotPrice: number,
  targetDelta: number,
  timeToExpiry: number,
  riskFreeRate: number,
  volatility: number,
  optionType: 'call' | 'put'
): number {
  const adjustedDelta = optionType === 'put' ? -Math.abs(targetDelta) : Math.abs(targetDelta);

  let lowerBound = optionType === 'put' ? spotPrice * 0.5 : spotPrice;
  let upperBound = optionType === 'put' ? spotPrice : spotPrice * 1.5;

  const maxIterations = 100;
  const tolerance = 0.001;

  for (let i = 0; i < maxIterations; i++) {
    const midStrike = (lowerBound + upperBound) / 2;
    const currentDelta = calculateDelta(spotPrice, midStrike, timeToExpiry, riskFreeRate, volatility, optionType);

    if (Math.abs(currentDelta - adjustedDelta) < tolerance) {
      return midStrike;
    }

    if (optionType === 'put') {
      if (currentDelta < adjustedDelta) {
        upperBound = midStrike;
      } else {
        lowerBound = midStrike;
      }
    } else {
      if (currentDelta > adjustedDelta) {
        lowerBound = midStrike;
      } else {
        upperBound = midStrike;
      }
    }
  }

  return (lowerBound + upperBound) / 2;
}

export function calculateBuyingPower(
  strategyType: 'short_put' | 'short_call' | 'short_strangle',
  spotPrice: number,
  strikePrice: number,
  putStrike?: number,
  callStrike?: number
): number {
  if (strategyType === 'short_put') {
    return strikePrice * 100 * 0.20;
  } else if (strategyType === 'short_call') {
    return spotPrice * 100 * 0.20;
  } else {
    const putBP = (putStrike || strikePrice) * 100 * 0.20;
    const callBP = spotPrice * 100 * 0.20;
    return Math.max(putBP, callBP);
  }
}
