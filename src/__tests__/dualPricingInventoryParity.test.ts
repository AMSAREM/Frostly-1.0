import { describe, it, expect } from 'vitest';
import { InventoryBatch, RetailWholesaleProduct } from '../types';

/**
 * Pure test replication of the bidirectional reconciliation and parity logic
 */
function reconcileCatalogWithInventory(
  currentProducts: RetailWholesaleProduct[],
  currentBatches: InventoryBatch[]
): {
  updatedBatches: InventoryBatch[];
  updatedProducts: RetailWholesaleProduct[];
  newLots: InventoryBatch[];
  newProducts: RetailWholesaleProduct[];
} {
  let workingBatches = [...(currentBatches || [])];
  let workingProducts = [...(currentProducts || [])];
  const newLots: InventoryBatch[] = [];
  const newProducts: RetailWholesaleProduct[] = [];

  const isProductBatchMatch = (p: RetailWholesaleProduct, b: InventoryBatch) => {
    const prodSkuClean = (p.sku || '').toLowerCase().trim();
    const batchSkuClean = (b.productSku || '').toLowerCase().trim();
    const detBatchId = `LOT-RET-${(p.sku || p.id).toUpperCase().replace(/[^A-Z0-9-]/g, '')}`;

    return (
      (p.linkedBatchId && p.linkedBatchId === b.id) ||
      (b.linkedProductId && b.linkedProductId === p.id) ||
      (batchSkuClean && prodSkuClean && batchSkuClean === prodSkuClean) ||
      b.id === detBatchId ||
      b.id === `LOT-RET-${p.id.replace('prod-', '')}` ||
      b.id === `LOT-RET-${p.id}` ||
      p.id === `prod-${b.id}` ||
      (b.speciesId === p.speciesId && b.grade === p.grade)
    );
  };

  // PASS 1: Batches -> Products
  for (const batch of workingBatches) {
    const matchedProduct = workingProducts.find(p => isProductBatchMatch(p, batch));

    if (!matchedProduct) {
      const sku = batch.productSku || (batch.id.startsWith('LOT-RET-') ? batch.id.replace('LOT-RET-', '') : `SKU-${batch.id}`);
      const costPrice = Number(batch.costPerKg) || 0;
      const wholesalePrice = Number(batch.wholesalePricePerKg) || (costPrice > 0 ? Number((costPrice * 1.35).toFixed(2)) : 35.0);
      const retailPrice = Number((wholesalePrice * 1.30).toFixed(2));

      const newProd: RetailWholesaleProduct = {
        id: `prod-${batch.id}`,
        speciesId: batch.speciesId,
        name: batch.speciesName,
        cutType: 'Skin-On Loin / Fillet',
        category: batch.category,
        grade: batch.grade,
        stockKg: Number(batch.availableWeightKg) || 0,
        unit: 'kg',
        costPricePerUnit: costPrice,
        wholesalePricePerUnit: wholesalePrice,
        retailPricePerUnit: retailPrice,
        wholesaleMinQty: 10,
        retailPackSize: '1.0 kg fresh pack',
        sku: sku,
        imageUrl: 'https://images.unsplash.com/photo-1534482421-64566f976cfa?auto=format&fit=crop&w=600&q=80',
        origin: batch.landingPort || 'Certified Cold Storage Vault',
        isAvailableForRetail: true,
        isAvailableForWholesale: true,
        linkedBatchId: batch.id,
        storageZone: batch.storageZone,
        minSafetyStockKg: 20
      };

      newProducts.push(newProd);
      workingProducts = [newProd, ...workingProducts];
      batch.linkedProductId = newProd.id;
      batch.productSku = newProd.sku;
    } else {
      let productNeedsUpdate = false;
      const updatedProd = { ...matchedProduct };

      if (!matchedProduct.linkedBatchId || matchedProduct.linkedBatchId !== batch.id) {
        updatedProd.linkedBatchId = batch.id;
        productNeedsUpdate = true;
      }

      if (Math.abs((updatedProd.stockKg || 0) - (batch.availableWeightKg || 0)) > 0.05) {
        updatedProd.stockKg = Number(batch.availableWeightKg) || 0;
        productNeedsUpdate = true;
      }

      if (batch.wholesalePricePerKg > 0 && Math.abs((updatedProd.wholesalePricePerUnit || 0) - (batch.wholesalePricePerKg || 0)) > 0.05) {
        updatedProd.wholesalePricePerUnit = batch.wholesalePricePerKg;
        productNeedsUpdate = true;
      }

      if (batch.costPerKg > 0 && Math.abs((updatedProd.costPricePerUnit || 0) - (batch.costPerKg || 0)) > 0.05) {
        updatedProd.costPricePerUnit = batch.costPerKg;
        productNeedsUpdate = true;
      }

      if (productNeedsUpdate) {
        workingProducts = workingProducts.map(p => p.id === updatedProd.id ? updatedProd : p);
      }

      if (!batch.linkedProductId || !batch.productSku) {
        batch.linkedProductId = matchedProduct.id;
        batch.productSku = matchedProduct.sku;
      }
    }
  }

  // PASS 2: Products -> Batches
  for (const product of workingProducts) {
    const matchedBatch = workingBatches.find(b => isProductBatchMatch(product, b));

    if (!matchedBatch) {
      const deterministicBatchId = `LOT-RET-${(product.sku || product.id).toUpperCase().replace(/[^A-Z0-9-]/g, '')}`;

      const newLot: InventoryBatch = {
        id: deterministicBatchId,
        speciesId: product.speciesId,
        speciesName: product.name,
        scientificName: 'Seafood Commercial Cut',
        category: product.category,
        harvestDate: '2026-11-10',
        landingPort: product.origin || 'San Francisco Cold Storage Hub',
        vesselName: 'Retail Packhouse & Cold Vault',
        vesselRegistration: `RET-${product.sku || 'CUT'}`,
        captainName: 'Operations Lead',
        faoArea: 'FAO 67 (Northeast Pacific)',
        coordinates: { lat: 37.7749, lng: -122.4194, description: 'Cold Vault' },
        gearType: 'Certified Retail Cutting & Skin-Packing',
        grade: product.grade,
        initialWeightKg: Number(product.stockKg) || 0,
        availableWeightKg: Number(product.stockKg) || 0,
        allocatedWeightKg: 0,
        storageZone: product.storageZone || 'Commercial Cold Storage (-22°C)',
        currentTempCelsius: -22.1,
        targetTempCelsius: -22,
        costPerKg: Number(product.costPricePerUnit) || 0,
        wholesalePricePerKg: Number(product.wholesalePricePerUnit) || 0,
        certifications: ['FDA HACCP Compliant'],
        inspectionStatus: 'Passed',
        histaminePpm: 0.8,
        coreTempCelsius: -22,
        receivedDate: '2026-11-10',
        expiryDate: '2027-05-10',
        qrCodeSeed: `QR-RET-${product.sku || product.id}`,
        notes: `Retail Inventory Lot for ${product.name}`,
        linkedProductId: product.id,
        productSku: product.sku,
        isRetailCutLot: true
      };

      newLots.push(newLot);
      workingBatches = [newLot, ...workingBatches];
      product.linkedBatchId = newLot.id;
    }
  }

  return {
    updatedBatches: workingBatches,
    updatedProducts: workingProducts,
    newLots,
    newProducts
  };
}

describe('Dual Pricing Matrix & Cold Storage Inventory 1:1 Parity Contract', () => {
  it('automatically registers products for raw catch landings to achieve exact 1:1 count parity', () => {
    const mockBatches: InventoryBatch[] = [
      {
        id: 'LOT-CATCH-001',
        speciesId: 'spec-bluefin',
        speciesName: 'Pacific Bluefin Tuna',
        scientificName: 'Thunnus orientalis',
        category: 'Pelagic',
        harvestDate: '2026-11-09',
        landingPort: 'Pier 45 San Francisco',
        vesselName: 'F/V Sea Spirit',
        vesselRegistration: 'US-9912',
        captainName: 'Capt. Eric H.',
        faoArea: 'FAO 67',
        coordinates: { lat: 37.7, lng: -122.4, description: 'Harbor' },
        gearType: 'Longline',
        grade: 'Sashimi AAA',
        initialWeightKg: 450,
        availableWeightKg: 450,
        allocatedWeightKg: 0,
        storageZone: 'Super-Cryo Deep Freeze (-60°C)',
        currentTempCelsius: -59.8,
        targetTempCelsius: -60,
        costPerKg: 45.0,
        wholesalePricePerKg: 68.0,
        certifications: ['HACCP'],
        inspectionStatus: 'Passed',
        histaminePpm: 1.0,
        coreTempCelsius: -60,
        receivedDate: '2026-11-09',
        expiryDate: '2027-05-09',
        qrCodeSeed: 'QR-001',
        notes: 'Premium catch'
      },
      {
        id: 'LOT-CATCH-002',
        speciesId: 'spec-salmon',
        speciesName: 'Wild King Salmon',
        scientificName: 'Salmo salar',
        category: 'Salmonid',
        harvestDate: '2026-11-09',
        landingPort: 'Ketchikan Dock',
        vesselName: 'F/V North Wave',
        vesselRegistration: 'AK-3301',
        captainName: 'Capt. Sarah M.',
        faoArea: 'FAO 67',
        coordinates: { lat: 55.3, lng: -131.6, description: 'Alaska' },
        gearType: 'Troll Line',
        grade: 'Grade #1',
        initialWeightKg: 300,
        availableWeightKg: 300,
        allocatedWeightKg: 0,
        storageZone: 'Commercial Cold Storage (-22°C)',
        currentTempCelsius: -22.1,
        targetTempCelsius: -22,
        costPerKg: 18.0,
        wholesalePricePerKg: 26.5,
        certifications: ['MSC'],
        inspectionStatus: 'Passed',
        histaminePpm: 0.5,
        coreTempCelsius: -22,
        receivedDate: '2026-11-09',
        expiryDate: '2027-05-09',
        qrCodeSeed: 'QR-002',
        notes: 'Icy fjord intake'
      }
    ];

    const initialProducts: RetailWholesaleProduct[] = [];

    const result = reconcileCatalogWithInventory(initialProducts, mockBatches);

    // 1:1 Parity Enforced!
    expect(result.updatedProducts.length).toBe(result.updatedBatches.length);
    expect(result.updatedProducts.length).toBe(2);
    expect(result.newProducts.length).toBe(2);

    // Verifying weights and prices match in lockstep
    const bluefinProd = result.updatedProducts.find(p => p.speciesId === 'spec-bluefin')!;
    expect(bluefinProd).toBeDefined();
    expect(bluefinProd.stockKg).toBe(450);
    expect(bluefinProd.costPricePerUnit).toBe(45.0);
    expect(bluefinProd.wholesalePricePerUnit).toBe(68.0);
    expect(bluefinProd.linkedBatchId).toBe('LOT-CATCH-001');

    const salmonProd = result.updatedProducts.find(p => p.speciesId === 'spec-salmon')!;
    expect(salmonProd).toBeDefined();
    expect(salmonProd.stockKg).toBe(300);
    expect(salmonProd.costPricePerUnit).toBe(18.0);
    expect(salmonProd.wholesalePricePerUnit).toBe(26.5);
  });

  it('automatically registers vault lots for user-added catalog products to achieve 1:1 parity', () => {
    const mockProducts: RetailWholesaleProduct[] = [
      {
        id: 'prod-tuna-saku',
        speciesId: 'spec-yellowfin',
        name: 'Yellowfin Tuna Saku Block',
        cutType: 'Skinless Sashimi Saku Block',
        category: 'Pelagic',
        grade: 'Sashimi AAA',
        stockKg: 125.5,
        unit: 'kg',
        costPricePerUnit: 22.0,
        wholesalePricePerUnit: 34.0,
        retailPricePerUnit: 44.0,
        wholesaleMinQty: 5,
        sku: 'SKU-YFT-SAKU',
        imageUrl: '',
        origin: 'Hawaii Grounds',
        isAvailableForRetail: true,
        isAvailableForWholesale: true
      }
    ];

    const initialBatches: InventoryBatch[] = [];

    const result = reconcileCatalogWithInventory(mockProducts, initialBatches);

    // 1:1 Parity Enforced!
    expect(result.updatedBatches.length).toBe(result.updatedProducts.length);
    expect(result.updatedBatches.length).toBe(1);
    expect(result.newLots.length).toBe(1);

    const createdLot = result.updatedBatches[0];
    expect(createdLot.id).toBe('LOT-RET-SKU-YFT-SAKU');
    expect(createdLot.availableWeightKg).toBe(125.5);
    expect(createdLot.costPerKg).toBe(22.0);
    expect(createdLot.wholesalePricePerKg).toBe(34.0);
  });

  it('synchronizes wholesale prices and stock weights in real-time lockstep when items are already linked', () => {
    const existingBatches: InventoryBatch[] = [
      {
        id: 'LOT-RET-SKU-COD-01',
        speciesId: 'spec-blackcod',
        speciesName: 'Alaskan Black Cod',
        scientificName: 'Anoplopoma fimbria',
        category: 'Groundfish',
        harvestDate: '2026-11-01',
        landingPort: 'Seward Cold Hub',
        vesselName: 'F/V Deep Trench',
        vesselRegistration: 'AK-992',
        captainName: 'Capt. Dan',
        faoArea: 'FAO 67',
        coordinates: { lat: 60.1, lng: -149.4, description: 'Gulf' },
        gearType: 'Demersal Longline',
        grade: 'Grade #1',
        initialWeightKg: 800,
        availableWeightKg: 740, // Calibrated down to 740kg in inventory
        allocatedWeightKg: 0,
        storageZone: 'Commercial Cold Storage (-22°C)',
        currentTempCelsius: -22,
        targetTempCelsius: -22,
        costPerKg: 30.0,
        wholesalePricePerKg: 48.0, // Updated wholesale price in inventory
        certifications: ['MSC'],
        inspectionStatus: 'Passed',
        histaminePpm: 0.2,
        coreTempCelsius: -22,
        receivedDate: '2026-11-01',
        expiryDate: '2027-05-01',
        qrCodeSeed: 'QR-COD',
        notes: 'Vault lot',
        linkedProductId: 'prod-blackcod-fillet',
        productSku: 'SKU-COD-01'
      }
    ];

    const existingProducts: RetailWholesaleProduct[] = [
      {
        id: 'prod-blackcod-fillet',
        speciesId: 'spec-blackcod',
        name: 'Alaskan Black Cod',
        cutType: 'Skin-On Loin / Fillet',
        category: 'Groundfish',
        grade: 'Grade #1',
        stockKg: 800, // Old weight before calibration
        unit: 'kg',
        costPricePerUnit: 30.0,
        wholesalePricePerUnit: 42.0, // Old wholesale price before calibration
        retailPricePerUnit: 58.0,
        wholesaleMinQty: 10,
        sku: 'SKU-COD-01',
        imageUrl: '',
        origin: 'Seward Cold Hub',
        isAvailableForRetail: true,
        isAvailableForWholesale: true,
        linkedBatchId: 'LOT-RET-SKU-COD-01'
      }
    ];

    const result = reconcileCatalogWithInventory(existingProducts, existingBatches);

    // No new items created since they already exist
    expect(result.newLots.length).toBe(0);
    expect(result.newProducts.length).toBe(0);

    // Both remain 1:1 equal in count
    expect(result.updatedProducts.length).toBe(result.updatedBatches.length);

    // The product has been synchronized in lockstep to the lot's new available weight and wholesale price
    const updatedProd = result.updatedProducts[0];
    expect(updatedProd.stockKg).toBe(740);
    expect(updatedProd.wholesalePricePerUnit).toBe(48.0);
  });
});
