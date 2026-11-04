import { describe, it, expect } from 'vitest';
import {
  calculateDynamicWholesalePrice,
  calculateGrossMarginPct,
  evaluateMarginHealth,
  getHistoricalSpeciesCostAverage,
  calculateCostVariance,
  formatQuoteExpiry
} from '../pricingEngine';
import { InventoryBatch } from '../../types';

describe('Pricing Engine & Price Fluctuation Controls', () => {
  describe('calculateDynamicWholesalePrice', () => {
    it('calculates wholesale selling price to achieve target gross margin', () => {
      // Cost = $10, Margin = 30% -> Price = $10 / (1 - 0.30) = $14.2857... -> $14.29
      expect(calculateDynamicWholesalePrice(10, 30)).toBe(14.29);
      // Cost = $20, Margin = 20% -> Price = $20 / (1 - 0.20) = $25.00
      expect(calculateDynamicWholesalePrice(20, 20)).toBe(25);
    });

    it('handles edge cases safely', () => {
      expect(calculateDynamicWholesalePrice(0, 30)).toBe(0);
      expect(calculateDynamicWholesalePrice(10, 100)).toBe(10);
      expect(calculateDynamicWholesalePrice(10, -10)).toBe(10);
    });
  });

  describe('calculateGrossMarginPct', () => {
    it('calculates gross margin percentage correctly', () => {
      // Cost = $10, Selling = $20 -> Margin = 50%
      expect(calculateGrossMarginPct(10, 20)).toBe(50);
      // Cost = $14, Selling = $20 -> Margin = 30%
      expect(calculateGrossMarginPct(14, 20)).toBe(30);
    });

    it('identifies negative margins when selling below cost', () => {
      // Cost = $20, Selling = $10 -> Margin = -100%
      expect(calculateGrossMarginPct(20, 10)).toBe(-100);
    });

    it('returns 0 when selling price is 0', () => {
      expect(calculateGrossMarginPct(10, 0)).toBe(0);
    });
  });

  describe('evaluateMarginHealth', () => {
    it('returns healthy status when margin meets or exceeds floor and target', () => {
      // Cost = $10, Selling = $20 (50% margin, target=30%, floor=18%)
      const result = evaluateMarginHealth(10, 20, 18, 30);
      expect(result.status).toBe('healthy');
      expect(result.isBelowFloor).toBe(false);
      expect(result.grossMarginPct).toBe(50);
    });

    it('returns warning status when margin is below floor but positive', () => {
      // Cost = $10, Selling = $11 (9.1% margin, floor=18%, target=30%)
      const result = evaluateMarginHealth(10, 11, 18, 30);
      expect(result.status).toBe('warning');
      expect(result.isBelowFloor).toBe(true);
      expect(result.suggestedPrice).toBe(14.29);
    });

    it('returns erosion status when selling price is at or below cost', () => {
      // Cost = $15, Selling = $12 (Negative margin)
      const result = evaluateMarginHealth(15, 12, 18, 30);
      expect(result.status).toBe('erosion');
      expect(result.isBelowFloor).toBe(true);
      expect(result.suggestedPrice).toBe(21.43);
    });
  });

  describe('getHistoricalSpeciesCostAverage', () => {
    const mockBatches: Partial<InventoryBatch>[] = [
      { id: 'LOT-1', speciesName: 'Pacific Bluefin Tuna', costPerKg: 20 },
      { id: 'LOT-2', speciesName: 'Pacific Bluefin Tuna', costPerKg: 30 },
      { id: 'LOT-3', speciesName: 'Wild Atlantic Salmon', costPerKg: 15 },
      { id: 'LOT-4', speciesName: 'Pacific Bluefin Tuna', costPerKg: 0 } // Ignored 0 cost
    ];

    it('calculates average cost across past batches for the given species', () => {
      const avg = getHistoricalSpeciesCostAverage(mockBatches as InventoryBatch[], 'Pacific Bluefin Tuna');
      expect(avg.avgCostPerKg).toBe(25);
      expect(avg.sampleCount).toBe(2);
    });

    it('returns 0 if no matching batches are found', () => {
      const avg = getHistoricalSpeciesCostAverage(mockBatches as InventoryBatch[], 'Lobster');
      expect(avg.avgCostPerKg).toBe(0);
      expect(avg.sampleCount).toBe(0);
    });
  });

  describe('calculateCostVariance', () => {
    it('calculates positive variance when current cost is higher than baseline', () => {
      const variance = calculateCostVariance(24, 20);
      expect(variance.variancePct).toBe(20);
      expect(variance.isHigher).toBe(true);
      expect(variance.isLower).toBe(false);
    });

    it('calculates negative variance when current cost is lower than baseline', () => {
      const variance = calculateCostVariance(16, 20);
      expect(variance.variancePct).toBe(20);
      expect(variance.isHigher).toBe(false);
      expect(variance.isLower).toBe(true);
    });

    it('handles zero baseline gracefully', () => {
      const variance = calculateCostVariance(20, 0);
      expect(variance.variancePct).toBe(0);
      expect(variance.isHigher).toBe(false);
      expect(variance.isLower).toBe(false);
    });
  });

  describe('formatQuoteExpiry', () => {
    it('formats quote expiration date and time window', () => {
      const baseDate = new Date('2026-05-10T12:00:00Z');
      const formatted = formatQuoteExpiry(24, baseDate);
      expect(formatted.expiresAt).toBeTruthy();
      expect(formatted.formattedLabel).toContain('24h spot quote');
      expect(String(formatted)).toContain('24h spot quote');
    });
  });
});
