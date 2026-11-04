import { InventoryBatch } from '../types';

/**
 * Standard Gross Margin Pricing:
 * Selling Price = Cost / (1 - Target Margin %)
 * Example: $10.00 cost with 30% target margin -> $10 / 0.70 = $14.29/kg
 */
export function calculateDynamicWholesalePrice(
  costPerKg: number,
  targetMarginPct: number = 30
): number {
  if (costPerKg <= 0) return 0;
  if (targetMarginPct >= 100 || targetMarginPct < 0) return costPerKg;
  const safeMargin = Math.min(Math.max(targetMarginPct, 5), 85) / 100;
  const price = costPerKg / (1 - safeMargin);
  return Math.round(price * 100) / 100;
}

/**
 * Calculates Gross Margin Percentage:
 * Margin % = ((Selling Price - Cost) / Selling Price) * 100
 */
export function calculateGrossMarginPct(
  costPerKg: number,
  sellingPricePerKg: number
): number {
  if (sellingPricePerKg <= 0) return 0;
  const margin = ((sellingPricePerKg - costPerKg) / sellingPricePerKg) * 100;
  return Math.round(margin * 10) / 10;
}

export type MarginHealthStatus = 'healthy' | 'warning' | 'erosion';

export interface MarginHealthEvaluation {
  status: MarginHealthStatus;
  marginPct: number;
  grossMarginPct: number;
  markupPct: number;
  isBelowFloor: boolean;
  suggestedPrice: number;
  message: string;
}

/**
 * Evaluates whether a proposed wholesale selling price meets minimum margin standards.
 */
export function evaluateMarginHealth(
  costPerKg: number,
  sellingPricePerKg: number,
  minMarginFloorPct: number = 18,
  targetMarginPct: number = 30
): MarginHealthEvaluation {
  if (costPerKg <= 0 || sellingPricePerKg <= 0) {
    return {
      status: 'warning',
      marginPct: 0,
      grossMarginPct: 0,
      markupPct: 0,
      isBelowFloor: false,
      suggestedPrice: 0,
      message: 'Enter cost and price to calculate margin health',
    };
  }

  const marginPct = calculateGrossMarginPct(costPerKg, sellingPricePerKg);
  const markupPct = Math.round(((sellingPricePerKg - costPerKg) / costPerKg) * 1000) / 10;
  const suggestedPrice = calculateDynamicWholesalePrice(costPerKg, targetMarginPct);

  if (sellingPricePerKg < costPerKg) {
    return {
      status: 'erosion',
      marginPct,
      grossMarginPct: marginPct,
      markupPct,
      isBelowFloor: true,
      suggestedPrice,
      message: `Negative margin! Selling below landed cost (${marginPct}% margin). Recommended: ${suggestedPrice.toFixed(2)}/kg`,
    };
  }

  if (marginPct < minMarginFloorPct) {
    return {
      status: 'warning',
      marginPct,
      grossMarginPct: marginPct,
      markupPct,
      isBelowFloor: true,
      suggestedPrice,
      message: `Low margin warning: ${marginPct}% is below the ${minMarginFloorPct}% policy floor. Recommended: ${suggestedPrice.toFixed(2)}/kg`,
    };
  }

  return {
    status: 'healthy',
    marginPct,
    grossMarginPct: marginPct,
    markupPct,
    isBelowFloor: false,
    suggestedPrice,
    message: `Healthy margin: ${marginPct}% gross margin (${markupPct}% markup).`,
  };
}

/**
 * Computes historical landed cost averages across recent batches for a species.
 */
export function getHistoricalSpeciesCostAverage(
  batches: InventoryBatch[],
  speciesIdOrName: string
): { avgCostPerKg: number; sampleCount: number; minCost: number; maxCost: number } {
  if (!batches || batches.length === 0 || !speciesIdOrName) {
    return { avgCostPerKg: 0, sampleCount: 0, minCost: 0, maxCost: 0 };
  }

  const query = speciesIdOrName.trim().toLowerCase();
  const matched = batches.filter(
    (b) =>
      (b.speciesId && b.speciesId.toLowerCase() === query) ||
      (b.speciesName && b.speciesName.toLowerCase().includes(query)) ||
      (b.id && b.id.toLowerCase().includes(query))
  );

  const validBatches = matched.filter((b) => typeof b.costPerKg === 'number' && b.costPerKg > 0);
  if (validBatches.length === 0) {
    return { avgCostPerKg: 0, sampleCount: 0, minCost: 0, maxCost: 0 };
  }

  const costs = validBatches.map((b) => b.costPerKg);
  const total = costs.reduce((sum, c) => sum + c, 0);
  const avgCostPerKg = Math.round((total / costs.length) * 100) / 100;
  const minCost = Math.min(...costs);
  const maxCost = Math.max(...costs);

  return {
    avgCostPerKg,
    sampleCount: validBatches.length,
    minCost,
    maxCost,
  };
}

/**
 * Calculates percentage fluctuation variance between current intake cost and baseline average.
 */
export function calculateCostVariance(
  currentCost: number,
  baselineCost: number
): { 
  variancePct: number; 
  direction: 'up' | 'down' | 'flat'; 
  isSignificant: boolean;
  isHigher: boolean;
  isLower: boolean;
} {
  if (baselineCost <= 0 || currentCost <= 0) {
    return { 
      variancePct: 0, 
      direction: 'flat', 
      isSignificant: false,
      isHigher: false,
      isLower: false
    };
  }

  const diff = currentCost - baselineCost;
  const variancePct = Math.round((diff / baselineCost) * 1000) / 10;

  let direction: 'up' | 'down' | 'flat' = 'flat';
  if (variancePct > 0.5) direction = 'up';
  else if (variancePct < -0.5) direction = 'down';

  return {
    variancePct: Math.abs(variancePct),
    direction,
    isSignificant: Math.abs(variancePct) >= 5, // Significant if >= 5% variance
    isHigher: direction === 'up',
    isLower: direction === 'down'
  };
}

/**
 * Formats a spot quote validity expiration window.
 */
export function formatQuoteExpiry(
  validityHours: number = 48,
  fromDate: Date = new Date()
): { expiresAt: string; formattedLabel: string; toString(): string } {
  const expiryDate = new Date(fromDate.getTime() + validityHours * 3600 * 1000);
  const formattedLabel = `${validityHours}h spot quote (valid until ${expiryDate.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })})`;

  return {
    expiresAt: expiryDate.toISOString(),
    formattedLabel,
    toString() {
      return formattedLabel;
    }
  };
}

