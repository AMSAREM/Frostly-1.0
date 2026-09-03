export const formatWeight = (kg: number, useImperial: boolean = false, decimals: number = 1): string => {
  if (useImperial) {
    const lbs = kg * 2.20462;
    return `${lbs.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} lbs`;
  }
  return `${kg.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} kg`;
};

export const formatTemp = (celsius: number, useImperial: boolean = false): string => {
  if (useImperial) {
    const fahr = (celsius * 9) / 5 + 32;
    return `${fahr.toFixed(1)}°F`;
  }
  return `${celsius.toFixed(1)}°C`;
};

export const formatCurrency = (amount: number, currency: string = 'GHS'): string => {
  const safeAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  const curr = currency || 'GHS';

  if (curr === 'GHS') {
    try {
      return new Intl.NumberFormat('en-GH', {
        style: 'currency',
        currency: 'GHS',
        currencyDisplay: 'symbol',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(safeAmount);
    } catch {
      return `GH₵${safeAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  }

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: curr,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(safeAmount);
  } catch {
    return `${curr} ${safeAmount.toFixed(2)}`;
  }
};

export const getYieldVariance = (requestedKg: number, actualKg: number | null) => {
  if (actualKg === null) return { diffKg: 0, pct: 0, isOver: false };
  const diffKg = actualKg - requestedKg;
  const pct = (diffKg / requestedKg) * 100;
  return {
    diffKg,
    pct,
    isOver: diffKg > 0,
    isExact: Math.abs(diffKg) < 0.001
  };
};
