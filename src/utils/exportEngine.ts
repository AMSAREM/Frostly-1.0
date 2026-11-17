import writeXlsxFile, { type CellObject, type Row, type SheetData } from 'write-excel-file/browser';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { RetailWholesaleProduct, InventoryBatch, ClientOrder, FinancialLedgerEntry } from '../types';

/**
 * Format currency helper for exports
 */
const formatMoney = (val: number | undefined | null, symbol = '$'): string => {
  const num = Number(val) || 0;
  return `${symbol}${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  try {
    return new Date(dateStr).toISOString().split('T')[0];
  } catch {
    return dateStr;
  }
};

const toCell = (val: unknown, bold = false): CellObject => {
  if (typeof val === 'number' && Number.isFinite(val)) {
    return { type: Number, value: val, ...(bold ? { fontWeight: 'bold' as const } : {}) };
  }
  if (typeof val === 'boolean') {
    return { type: Boolean, value: val, ...(bold ? { fontWeight: 'bold' as const } : {}) };
  }
  return {
    type: String,
    value: val === null || val === undefined ? '' : String(val),
    ...(bold ? { fontWeight: 'bold' as const } : {})
  };
};

const recordsToSheetData = (rows: Record<string, unknown>[], fallbackHeaders: string[] = []): SheetData => {
  const headers = rows.length > 0 ? Object.keys(rows[0]) : fallbackHeaders;
  if (headers.length === 0) {
    return [[{ type: String, value: 'No data available' }]];
  }
  const headerRow: Row = headers.map((header) => ({
    type: String,
    value: header,
    fontWeight: 'bold',
    backgroundColor: '#0F172A',
    color: '#FFFFFF'
  }));
  const bodyRows: Row[] = rows.map((row) => headers.map((h) => toCell(row[h])));
  return [headerRow, ...bodyRows];
};

const aoaToSheetData = (rows: unknown[][]): SheetData => {
  return rows.map((row, rowIdx) =>
    row.map((val) => toCell(val, rowIdx === 0))
  );
};

/**
 * ============================================================================
 * 1. DUAL PRICING CATALOG EXPORTS (EXCEL & PDF)
 * ============================================================================
 */

export interface ExportDualPricingOptions {
  products: RetailWholesaleProduct[];
  batches?: InventoryBatch[];
  companyName?: string;
  currencySymbol?: string;
}

export function exportDualPricingToExcel({
  products,
  batches = [],
  companyName = 'Amansocean Seafoods',
  currencySymbol = '$'
}: ExportDualPricingOptions): Promise<void> {
  const dateStr = new Date().toISOString().split('T')[0];

  // 1. Main Dual Price Catalog Worksheet
  const catalogRows = products.map(prod => {
    const linkedBatch = batches.find(b => 
      b.id === prod.linkedBatchId || 
      b.linkedProductId === prod.id ||
      (b.productSku && prod.sku && b.productSku.toLowerCase() === prod.sku.toLowerCase())
    );

    const cost = Number(prod.costPricePerUnit) || 0;
    const wholesale = Number(prod.wholesalePricePerUnit) || 0;
    const retail = Number(prod.retailPricePerUnit) || 0;
    const stockKg = Number(prod.stockKg) || 0;
    const totalValue = stockKg * wholesale;

    const wholesaleMarginPct = wholesale > 0 ? ((wholesale - cost) / wholesale) * 100 : 0;
    const retailMarginPct = retail > 0 ? ((retail - cost) / retail) * 100 : 0;

    return {
      'SKU': prod.sku,
      'Seafood Product Name': prod.name,
      'Cut Type': prod.cutType,
      'Category': prod.category,
      'Quality Grade': prod.grade,
      'Origin / Catch Port': prod.origin,
      'Storage Zone': prod.storageZone || 'Commercial Cold Storage (-22°C)',
      [`Dock Landing Cost (${currencySymbol}/${prod.unit})`]: cost,
      [`Wholesale B2B Price (${currencySymbol}/${prod.unit})`]: wholesale,
      [`Retail Counter Price (${currencySymbol}/${prod.unit})`]: retail,
      'Wholesale Margin (%)': Number(wholesaleMarginPct.toFixed(1)),
      'Retail Margin (%)': Number(retailMarginPct.toFixed(1)),
      'Wholesale MOQ (kg)': prod.wholesaleMinQty,
      'Retail Pack Format': prod.retailPackSize || 'Standard Cut',
      'On-Hand Stock (kg)': stockKg,
      [`Total Stock Value (${currencySymbol})`]: Number(totalValue.toFixed(2)),
      'Linked Vault Lot': linkedBatch?.id || prod.linkedBatchId || 'Unlinked',
      'Parity Status': linkedBatch ? 'Linked (1:1)' : 'Pending Sync'
    };
  });

  const colWidths = [
    { width: 14 }, // SKU
    { width: 32 }, // Product Name
    { width: 24 }, // Cut Type
    { width: 14 }, // Category
    { width: 14 }, // Grade
    { width: 22 }, // Origin
    { width: 28 }, // Storage Zone
    { width: 18 }, // Cost
    { width: 18 }, // Wholesale
    { width: 18 }, // Retail
    { width: 16 }, // Wholesale Margin
    { width: 16 }, // Retail Margin
    { width: 14 }, // MOQ
    { width: 20 }, // Pack Format
    { width: 16 }, // Stock
    { width: 20 }, // Total Value
    { width: 22 }, // Linked Vault Lot
    { width: 16 }  // Parity Status
  ];

  // 2. Executive Summary Worksheet
  const totalStockKg = products.reduce((sum, p) => sum + (Number(p.stockKg) || 0), 0);
  const totalCommercialValuation = products.reduce((sum, p) => sum + ((Number(p.stockKg) || 0) * (Number(p.wholesalePricePerUnit) || 0)), 0);
  const totalCostValuation = products.reduce((sum, p) => sum + ((Number(p.stockKg) || 0) * (Number(p.costPricePerUnit) || 0)), 0);
  const avgWholesaleMargin = products.length > 0
    ? products.reduce((sum, p) => {
        const c = Number(p.costPricePerUnit) || 0;
        const w = Number(p.wholesalePricePerUnit) || 0;
        return sum + (w > 0 ? ((w - c) / w) * 100 : 0);
      }, 0) / products.length
    : 0;
  const avgRetailMargin = products.length > 0
    ? products.reduce((sum, p) => {
        const c = Number(p.costPricePerUnit) || 0;
        const r = Number(p.retailPricePerUnit) || 0;
        return sum + (r > 0 ? ((r - c) / r) * 100 : 0);
      }, 0) / products.length
    : 0;

  const summaryData = [
    ['FROSTLY COMMERCIAL DUAL PRICING & INVENTORY SUMMARY'],
    ['Company / Organization', companyName],
    ['Report Date', dateStr],
    ['Parity State', `${products.length} Products = ${batches.length} Vault Lots (1:1 Bidirectional)`],
    [''],
    ['KEY PERFORMANCE METRIC', 'VALUE'],
    ['Total Catalog Product SKUs', products.length],
    ['Total Cold-Vault Stock on Hand (kg)', Number(totalStockKg.toFixed(2))],
    [`Total Commercial Stock Value (${currencySymbol})`, Number(totalCommercialValuation.toFixed(2))],
    [`Total Inventory Cost Basis (${currencySymbol})`, Number(totalCostValuation.toFixed(2))],
    [`Projected Vault Gross Profit (${currencySymbol})`, Number((totalCommercialValuation - totalCostValuation).toFixed(2))],
    ['Average Wholesale B2B Margin (%)', `${avgWholesaleMargin.toFixed(1)}%`],
    ['Average Retail Counter Margin (%)', `${avgRetailMargin.toFixed(1)}%`],
    ['Default Bulk Customer Discount Threshold', '10 kg (10% Tier)'],
    [''],
    ['CONFIDENTIAL - FOR INTERNAL COMMERCIAL AND APPROVED CLIENT PROCUREMENT USE ONLY']
  ];

  const cleanCompanyName = companyName.replace(/[^a-zA-Z0-9_-]/g, '_');
  return writeXlsxFile([
    {
      sheet: 'Dual Price Catalog',
      data: recordsToSheetData(catalogRows),
      columns: colWidths
    },
    {
      sheet: 'Commercial Summary',
      data: aoaToSheetData(summaryData),
      columns: [{ width: 38 }, { width: 40 }]
    }
  ]).toFile(`${cleanCompanyName}_Dual_Pricing_Catalog_${dateStr}.xlsx`);
}

export function exportDualPricingToPdf({
  products,
  batches = [],
  companyName = 'Amansocean Seafoods',
  currencySymbol = '$'
}: ExportDualPricingOptions): void {
  const dateStr = new Date().toISOString().split('T')[0];
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 68, 'F');

  // Accent Line
  doc.setFillColor(16, 185, 129); // emerald-500
  doc.rect(0, 68, pageWidth, 4, 'F');

  // Title & Subtitle
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(`${companyName.toUpperCase()} • DUAL PRICING & WHOLESALE CATALOG`, 28, 30);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(`Official B2B & Retail Price Matrix | 1:1 Cold Vault Parity: ${products.length} Products = ${batches.length} Lots`, 28, 48);

  // Date & Metadata on Right
  doc.setFont('helvetica', 'bold');
  doc.text(`DATE: ${dateStr}`, pageWidth - 140, 30);
  doc.setFont('helvetica', 'normal');
  doc.text(`TOTAL SKUs: ${products.length}`, pageWidth - 140, 48);

  // Financial Stats Ribbon
  const totalStockKg = products.reduce((sum, p) => sum + (Number(p.stockKg) || 0), 0);
  const totalValuation = products.reduce((sum, p) => sum + ((Number(p.stockKg) || 0) * (Number(p.wholesalePricePerUnit) || 0)), 0);

  doc.setFillColor(241, 245, 249); // slate-100
  doc.roundedRect(28, 80, pageWidth - 56, 30, 4, 4, 'F');

  doc.setTextColor(51, 65, 85); // slate-700
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Available Stock: `, 40, 99);
  doc.setTextColor(15, 23, 42);
  doc.text(`${totalStockKg.toLocaleString()} kg`, 135, 99);

  doc.setTextColor(51, 65, 85);
  doc.text(`Total Commercial Value: `, 230, 99);
  doc.setTextColor(5, 150, 105); // emerald-600
  doc.text(`${formatMoney(totalValuation, currencySymbol)}`, 345, 99);

  doc.setTextColor(51, 65, 85);
  doc.text(`Standard Terms: `, 470, 99);
  doc.setTextColor(15, 23, 42);
  doc.text(`Wholesale MOQ 10kg · Net-30 Upon Credit Approval`, 545, 99);

  // Table Body
  const tableData = products.map(prod => {
    const cost = Number(prod.costPricePerUnit) || 0;
    const wholesale = Number(prod.wholesalePricePerUnit) || 0;
    const retail = Number(prod.retailPricePerUnit) || 0;
    const stock = Number(prod.stockKg) || 0;
    const wholesaleMarginPct = wholesale > 0 ? ((wholesale - cost) / wholesale) * 100 : 0;
    const retailMarginPct = retail > 0 ? ((retail - cost) / retail) * 100 : 0;

    return [
      prod.sku,
      prod.name,
      prod.cutType,
      prod.grade,
      formatMoney(cost, currencySymbol),
      formatMoney(wholesale, currencySymbol),
      formatMoney(retail, currencySymbol),
      `${wholesaleMarginPct.toFixed(0)}%`,
      `${retailMarginPct.toFixed(0)}%`,
      `${stock.toFixed(1)} ${prod.unit}`,
      formatMoney(stock * wholesale, currencySymbol),
      prod.linkedBatchId || 'Unlinked'
    ];
  });

  autoTable(doc, {
    startY: 118,
    margin: { left: 28, right: 28 },
    head: [[
      'SKU', 
      'Seafood Product', 
      'Commercial Cut', 
      'Grade', 
      'Landing Cost', 
      'Wholesale (B2B)', 
      'Retail Counter', 
      'W. Margin', 
      'R. Margin', 
      'Stock', 
      'Lot Value', 
      'Vault Lot'
    ]],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'left'
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 4.5,
      textColor: [30, 41, 59],
      overflow: 'linebreak'
    },
    columnStyles: {
      0: { cellWidth: 55, fontStyle: 'bold' },
      1: { cellWidth: 120, fontStyle: 'bold' },
      2: { cellWidth: 90 },
      3: { cellWidth: 55 },
      4: { cellWidth: 55, halign: 'right' },
      5: { cellWidth: 65, halign: 'right', fontStyle: 'bold', textColor: [49, 46, 129] },
      6: { cellWidth: 60, halign: 'right', textColor: [5, 150, 105] },
      7: { cellWidth: 45, halign: 'center' },
      8: { cellWidth: 45, halign: 'center' },
      9: { cellWidth: 50, halign: 'right', fontStyle: 'bold' },
      10: { cellWidth: 65, halign: 'right', fontStyle: 'bold', textColor: [5, 150, 105] },
      11: { cellWidth: 70, fontSize: 6.5 }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    didDrawPage: (data) => {
      // Footer on every page
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(
        `Frostly Seafood ERP • Certified FDA HACCP & Cold-Chain Custody • Page ${data.pageNumber}`,
        28,
        pageHeight - 16
      );
      doc.text(
        `Prices subject to catch-weight landing index. Confidential document.`,
        pageWidth - 280,
        pageHeight - 16
      );
    }
  });

  const cleanCompanyName = companyName.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`${cleanCompanyName}_Dual_Pricing_Catalog_${dateStr}.pdf`);
}

/**
 * ============================================================================
 * 2. COLD VAULT INVENTORY LEDGER EXPORTS (EXCEL & PDF)
 * ============================================================================
 */

export interface ExportInventoryOptions {
  batches: InventoryBatch[];
  products?: RetailWholesaleProduct[];
  companyName?: string;
  currencySymbol?: string;
}

export function exportInventoryToExcel({
  batches,
  products: _products = [],
  companyName = 'Amansocean Seafoods',
  currencySymbol = '$'
}: ExportInventoryOptions): Promise<void> {
  const dateStr = new Date().toISOString().split('T')[0];

  // 1. Detailed Cold Storage Lots Worksheet
  const lotRows = batches.map(batch => {
    const cost = Number(batch.costPerKg) || 0;
    const wholesale = Number(batch.wholesalePricePerKg) || 0;
    const available = Number(batch.availableWeightKg) || 0;
    const allocated = Number(batch.allocatedWeightKg) || 0;
    const totalIntake = Number(batch.initialWeightKg) || available;
    const totalLotCost = available * cost;
    const totalLotValue = available * wholesale;
    const estProfit = totalLotValue - totalLotCost;

    return {
      'Lot ID': batch.id,
      'Species Name': batch.speciesName,
      'Scientific Name': batch.scientificName,
      'Category': batch.category,
      'Quality Grade': batch.grade,
      'Storage Zone': batch.storageZone,
      'Current Temp (°C)': batch.currentTempCelsius,
      'Target Temp (°C)': batch.targetTempCelsius,
      'Available Weight (kg)': available,
      'Allocated / Reserved (kg)': allocated,
      'Initial Intake Weight (kg)': totalIntake,
      [`Intake Cost (${currencySymbol}/kg)`]: cost,
      [`Wholesale Price (${currencySymbol}/kg)`]: wholesale,
      [`Lot Cost Basis (${currencySymbol})`]: Number(totalLotCost.toFixed(2)),
      [`Lot Commercial Value (${currencySymbol})`]: Number(totalLotValue.toFixed(2)),
      [`Estimated Profit (${currencySymbol})`]: Number(estProfit.toFixed(2)),
      'Harvest Date': formatDate(batch.harvestDate),
      'Dock Received Date': formatDate(batch.receivedDate),
      'Expiry Date': formatDate(batch.expiryDate),
      'Vessel Name': batch.vesselName,
      'Vessel Registration': batch.vesselRegistration,
      'Landing Port': batch.landingPort,
      'FAO Catch Area': batch.faoArea,
      'Inspection Status': batch.inspectionStatus,
      'Histamine Level (ppm)': batch.histaminePpm ?? 'N/A',
      'Linked Catalog SKU': batch.productSku || 'N/A',
      'Linked Product ID': batch.linkedProductId || 'N/A',
      'HACCP Certifications': (batch.certifications || []).join(', ')
    };
  });

  const lotsCols = [
    { width: 18 }, // Lot ID
    { width: 28 }, // Species
    { width: 26 }, // Scientific
    { width: 14 }, // Category
    { width: 14 }, // Grade
    { width: 28 }, // Storage Zone
    { width: 16 }, // Current Temp
    { width: 16 }, // Target Temp
    { width: 20 }, // Available Weight
    { width: 20 }, // Allocated Weight
    { width: 20 }, // Initial Intake
    { width: 16 }, // Cost / kg
    { width: 18 }, // Wholesale / kg
    { width: 18 }, // Lot Cost Basis
    { width: 20 }, // Lot Commercial Value
    { width: 18 }, // Estimated Profit
    { width: 14 }, // Harvest Date
    { width: 16 }, // Received Date
    { width: 14 }, // Expiry Date
    { width: 22 }, // Vessel Name
    { width: 18 }, // Vessel Reg
    { width: 24 }, // Landing Port
    { width: 24 }, // FAO Area
    { width: 16 }, // Inspection
    { width: 18 }, // Histamine
    { width: 18 }, // Product SKU
    { width: 20 }, // Product ID
    { width: 30 }  // Certifications
  ];

  // 2. Storage Zone Breakdown Worksheet
  const zones = Array.from(new Set(batches.map(b => b.storageZone)));
  const zoneSummary = zones.map(zone => {
    const zoneLots = batches.filter(b => b.storageZone === zone);
    const weight = zoneLots.reduce((s, b) => s + (Number(b.availableWeightKg) || 0), 0);
    const value = zoneLots.reduce((s, b) => s + ((Number(b.availableWeightKg) || 0) * (Number(b.wholesalePricePerKg) || 0)), 0);
    const cost = zoneLots.reduce((s, b) => s + ((Number(b.availableWeightKg) || 0) * (Number(b.costPerKg) || 0)), 0);

    return {
      'Cold Storage Zone': zone,
      'Active Lots Count': zoneLots.length,
      'Total Stored Weight (kg)': Number(weight.toFixed(2)),
      [`Total Zone Commercial Value (${currencySymbol})`]: Number(value.toFixed(2)),
      [`Total Zone Asset Cost (${currencySymbol})`]: Number(cost.toFixed(2)),
      [`Unrealized Gross Margin (${currencySymbol})`]: Number((value - cost).toFixed(2))
    };
  });

  const cleanCompanyName = companyName.replace(/[^a-zA-Z0-9_-]/g, '_');
  return writeXlsxFile([
    {
      sheet: 'Vault Lots Master',
      data: recordsToSheetData(lotRows),
      columns: lotsCols
    },
    {
      sheet: 'Cold Zone Analytics',
      data: recordsToSheetData(zoneSummary),
      columns: [
        { width: 32 },
        { width: 16 },
        { width: 24 },
        { width: 26 },
        { width: 24 },
        { width: 26 }
      ]
    }
  ]).toFile(`${cleanCompanyName}_Cold_Storage_Inventory_${dateStr}.xlsx`);
}

export function exportInventoryToPdf({
  batches,
  products = [],
  companyName = 'Amansocean Seafoods',
  currencySymbol = '$'
}: ExportInventoryOptions): void {
  const dateStr = new Date().toISOString().split('T')[0];
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 68, 'F');

  // Accent Line
  doc.setFillColor(59, 130, 246); // blue-500
  doc.rect(0, 68, pageWidth, 4, 'F');

  // Title & Subtitle
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(`${companyName.toUpperCase()} • COLD STORAGE INVENTORY LEDGER`, 28, 30);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(`Perpetual Catch-Weight Vault Balance Sheet · HACCP Cold Chain Custody Verification`, 28, 48);

  // Date & Metadata on Right
  doc.setFont('helvetica', 'bold');
  doc.text(`DATE: ${dateStr}`, pageWidth - 140, 30);
  doc.setFont('helvetica', 'normal');
  doc.text(`ACTIVE LOTS: ${batches.length}`, pageWidth - 140, 48);

  // Vault Stats Ribbon
  const totalAvailableKg = batches.reduce((sum, b) => sum + (Number(b.availableWeightKg) || 0), 0);
  const totalAllocatedKg = batches.reduce((sum, b) => sum + (Number(b.allocatedWeightKg) || 0), 0);
  const totalValuation = batches.reduce((sum, b) => sum + ((Number(b.availableWeightKg) || 0) * (Number(b.wholesalePricePerKg) || 0)), 0);

  doc.setFillColor(241, 245, 249); // slate-100
  doc.roundedRect(28, 80, pageWidth - 56, 30, 4, 4, 'F');

  doc.setTextColor(51, 65, 85);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`Available Weight: `, 40, 99);
  doc.setTextColor(5, 150, 105);
  doc.text(`${totalAvailableKg.toLocaleString()} kg`, 125, 99);

  doc.setTextColor(51, 65, 85);
  doc.text(`Reserved / In Transit: `, 220, 99);
  doc.setTextColor(217, 119, 6); // amber-600
  doc.text(`${totalAllocatedKg.toLocaleString()} kg`, 330, 99);

  doc.setTextColor(51, 65, 85);
  doc.text(`Total Vault Valuation: `, 430, 99);
  doc.setTextColor(15, 23, 42);
  doc.text(`${formatMoney(totalValuation, currencySymbol)}`, 540, 99);

  // Table Body
  const tableData = batches.map(batch => {
    const cost = Number(batch.costPerKg) || 0;
    const wholesale = Number(batch.wholesalePricePerKg) || 0;
    const available = Number(batch.availableWeightKg) || 0;
    const lotValue = available * wholesale;

    return [
      batch.id,
      batch.speciesName,
      batch.grade,
      batch.storageZone,
      `${batch.currentTempCelsius.toFixed(1)}°C`,
      `${available.toFixed(1)} kg`,
      formatMoney(cost, currencySymbol),
      formatMoney(wholesale, currencySymbol),
      formatMoney(lotValue, currencySymbol),
      batch.vesselName,
      batch.landingPort,
      batch.inspectionStatus
    ];
  });

  autoTable(doc, {
    startY: 118,
    margin: { left: 28, right: 28 },
    head: [[
      'Lot ID',
      'Species Name',
      'Grade',
      'Storage Zone',
      'Temp',
      'Available',
      'Dock Cost',
      'Wholesale',
      'Total Value',
      'Vessel',
      'Landing Port',
      'HACCP'
    ]],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'left'
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 4.5,
      textColor: [30, 41, 59],
      overflow: 'linebreak'
    },
    columnStyles: {
      0: { cellWidth: 70, fontStyle: 'bold' },
      1: { cellWidth: 125, fontStyle: 'bold' },
      2: { cellWidth: 55 },
      3: { cellWidth: 95 },
      4: { cellWidth: 42, halign: 'center' },
      5: { cellWidth: 55, halign: 'right', fontStyle: 'bold', textColor: [5, 150, 105] },
      6: { cellWidth: 50, halign: 'right' },
      7: { cellWidth: 55, halign: 'right', fontStyle: 'bold', textColor: [49, 46, 129] },
      8: { cellWidth: 65, halign: 'right', fontStyle: 'bold', textColor: [5, 150, 105] },
      9: { cellWidth: 75 },
      10: { cellWidth: 65 },
      11: { cellWidth: 40, halign: 'center' }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    didDrawPage: (data) => {
      // Footer on every page
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(
        `Frostly Seafood ERP • Cold Vault Inventory Custody Ledger • Page ${data.pageNumber}`,
        28,
        pageHeight - 16
      );
      doc.text(
        `Certified scale intake weights. Histamine & core probe logged.`,
        pageWidth - 270,
        pageHeight - 16
      );
    }
  });

  const cleanCompanyName = companyName.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`${cleanCompanyName}_Cold_Storage_Inventory_${dateStr}.pdf`);
}

/**
 * ============================================================================
 * 3. WHOLESALE B2B ORDERS EXPORTS (EXCEL & PDF)
 * ============================================================================
 */

export interface ExportOrdersOptions {
  orders: ClientOrder[];
  companyName?: string;
  currencySymbol?: string;
}

export function exportWholesaleOrdersToExcel({
  orders,
  companyName = 'Amansocean Seafoods',
  currencySymbol = '$'
}: ExportOrdersOptions): Promise<void> {
  const dateStr = new Date().toISOString().split('T')[0];

  const orderRows = orders.map(o => {
    const totalVal = o.adjustedTotalUSD || o.quotedTotalUSD || 0;
    const itemsDesc = o.items.map(i => `${i.speciesName} (${i.actualWeighedKg || i.requestedWeightKg}kg @ ${formatMoney(i.pricePerKg, currencySymbol)}/kg)`).join('; ');
    const totalKg = o.items.reduce((s, i) => s + (Number(i.actualWeighedKg || i.requestedWeightKg) || 0), 0);

    return {
      'Order ID': o.id,
      'Client Name': o.clientName,
      'Client Category': o.clientCategory,
      'City / Destination': o.destinationCity,
      'Delivery Address': o.deliveryAddress,
      'Order Date': formatDate(o.orderDate),
      'Required Delivery': formatDate(o.requiredDeliveryDate),
      'Fulfillment Status': o.status,
      'Payment Status': o.paymentStatus,
      'Payment Terms': o.paymentTerms || 'Net-30',
      'Due Date': o.paymentDueDate ? formatDate(o.paymentDueDate) : 'N/A',
      'Credit Authorized By': o.creditAuthorizedBy || 'Standard',
      'Total Net Weight (kg)': Number(totalKg.toFixed(2)),
      [`Order Total Value (${currencySymbol})`]: Number(totalVal.toFixed(2)),
      'Packaging Requirement': o.packagingRequirement,
      'Order Items Detail': itemsDesc,
      'Driver Assigned': o.assignedDriver || 'Unassigned',
      'Reefer Vehicle': o.assignedReeferId || 'Unassigned'
    };
  });

  const cleanCompanyName = companyName.replace(/[^a-zA-Z0-9_-]/g, '_');
  return writeXlsxFile([
    {
      sheet: 'Wholesale Orders',
      data: recordsToSheetData(orderRows),
      columns: [
        { width: 14 },
        { width: 28 },
        { width: 22 },
        { width: 18 },
        { width: 26 },
        { width: 14 },
        { width: 16 },
        { width: 18 },
        { width: 16 },
        { width: 14 },
        { width: 14 },
        { width: 18 },
        { width: 18 },
        { width: 20 },
        { width: 28 },
        { width: 45 },
        { width: 16 },
        { width: 16 }
      ]
    }
  ]).toFile(`${cleanCompanyName}_Wholesale_Orders_${dateStr}.xlsx`);
}

export function exportWholesaleOrdersToPdf({
  orders,
  companyName = 'Amansocean Seafoods',
  currencySymbol = '$'
}: ExportOrdersOptions): void {
  const dateStr = new Date().toISOString().split('T')[0];
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 68, 'F');

  // Accent Line
  doc.setFillColor(99, 102, 241); // indigo-500
  doc.rect(0, 68, pageWidth, 4, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(`${companyName.toUpperCase()} • WHOLESALE ORDERS & RECEIVABLES`, 28, 30);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(`Commercial B2B Fulfillment, Payment Terms & Delivery Schedule Report`, 28, 48);

  doc.setFont('helvetica', 'bold');
  doc.text(`DATE: ${dateStr}`, pageWidth - 140, 30);
  doc.setFont('helvetica', 'normal');
  doc.text(`TOTAL ORDERS: ${orders.length}`, pageWidth - 140, 48);

  const totalValue = orders.reduce((s, o) => s + (Number(o.adjustedTotalUSD || o.quotedTotalUSD) || 0), 0);
  const paidCount = orders.filter(o => o.paymentStatus === 'Paid' || o.paymentStatus === 'Paid in Full').length;

  doc.setFillColor(241, 245, 249);
  doc.roundedRect(28, 80, pageWidth - 56, 30, 4, 4, 'F');

  doc.setTextColor(51, 65, 85);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Order Value: `, 40, 99);
  doc.setTextColor(15, 23, 42);
  doc.text(`${formatMoney(totalValue, currencySymbol)}`, 130, 99);

  doc.setTextColor(51, 65, 85);
  doc.text(`Settled / Collected: `, 240, 99);
  doc.setTextColor(5, 150, 105);
  doc.text(`${paidCount} of ${orders.length} Orders`, 335, 99);

  doc.setTextColor(51, 65, 85);
  doc.text(`Outstanding Credit: `, 450, 99);
  doc.setTextColor(217, 119, 6);
  const pendingCredit = orders
    .filter(o => o.paymentStatus !== 'Paid' && o.paymentStatus !== 'Paid in Full' && o.status !== 'Voided' && o.status !== 'Cancelled')
    .reduce((s, o) => s + (Number(o.adjustedTotalUSD || o.quotedTotalUSD) || 0), 0);
  doc.text(`${formatMoney(pendingCredit, currencySymbol)}`, 545, 99);

  const tableData = orders.map(o => {
    const finalVal = o.adjustedTotalUSD || o.quotedTotalUSD || 0;
    const itemsSummary = o.items.map(i => `${i.speciesName} (${i.actualWeighedKg || i.requestedWeightKg}kg)`).join(', ');

    return [
      o.id,
      o.clientName,
      o.destinationCity,
      itemsSummary,
      o.packagingRequirement,
      o.paymentStatus === 'Paid' ? 'Paid' : (o.paymentTerms || 'Net-30'),
      o.requiredDeliveryDate,
      o.status,
      formatMoney(finalVal, currencySymbol)
    ];
  });

  autoTable(doc, {
    startY: 118,
    margin: { left: 28, right: 28 },
    head: [[
      'Order ID',
      'Client / Restaurant',
      'City',
      'Species & Quoted Qty',
      'Packaging',
      'Payment Terms',
      'Delivery Date',
      'Status',
      'Order Total'
    ]],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'left'
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 4.5,
      textColor: [30, 41, 59]
    },
    columnStyles: {
      0: { cellWidth: 65, fontStyle: 'bold' },
      1: { cellWidth: 120, fontStyle: 'bold' },
      2: { cellWidth: 65 },
      3: { cellWidth: 160 },
      4: { cellWidth: 90, fontSize: 7 },
      5: { cellWidth: 65, halign: 'center' },
      6: { cellWidth: 65, halign: 'center' },
      7: { cellWidth: 65, halign: 'center' },
      8: { cellWidth: 70, halign: 'right', fontStyle: 'bold', textColor: [15, 23, 42] }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    didDrawPage: (data) => {
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Frostly Seafood ERP • Commercial Wholesale Fulfillment • Page ${data.pageNumber}`,
        28,
        pageHeight - 16
      );
      doc.text(
        `Catch-weight verified invoices. Net credit terms enforceable upon signing.`,
        pageWidth - 310,
        pageHeight - 16
      );
    }
  });

  const cleanCompanyName = companyName.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`${cleanCompanyName}_Wholesale_Orders_${dateStr}.pdf`);
}

/**
 * ============================================================================
 * 4. OPERATING EXPENSE LEDGER & HISTORY EXPORTS (EXCEL & PDF)
 * ============================================================================
 */

export interface ExportExpensesOptions {
  expenses: FinancialLedgerEntry[];
  companyName?: string;
  currencySymbol?: string;
}

export function exportExpensesToExcel({
  expenses,
  companyName = 'Amansocean Seafoods',
  currencySymbol = '$'
}: ExportExpensesOptions): Promise<void> {
  const dateStr = new Date().toISOString().split('T')[0];

  const rows = expenses.map(exp => ({
    'Date': formatDate(exp.date),
    'Ref / Voucher #': exp.voucherNumber || exp.referenceId || exp.id,
    'Expense Category': exp.category,
    'Vendor / Payee': exp.entityName || 'Operational Vendor',
    'Description / Memo': exp.description,
    'Payment Method': exp.paymentMethod,
    [`Amount (${currencySymbol})`]: Number((Number(exp.amount) || 0).toFixed(2)),
    'Status': exp.status,
    'Notes': exp.notes || ''
  }));

  // Category Breakdown sheet
  const byCategory = expenses.reduce<Record<string, { total: number; count: number }>>((acc, exp) => {
    const cat = exp.category || 'Operating Expense';
    if (!acc[cat]) acc[cat] = { total: 0, count: 0 };
    acc[cat].total += Number(exp.amount) || 0;
    acc[cat].count += 1;
    return acc;
  }, {});

  const totalOpEx = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const summaryRows = [
    ['OPERATING EXPENSE (OPEX) LEDGER SUMMARY'],
    ['Company / Organization', companyName],
    ['Export Date', dateStr],
    ['Total Operating Expenses', Number(totalOpEx.toFixed(2))],
    ['Total Entries', expenses.length],
    [''],
    ['CATEGORY', 'ENTRIES', `TOTAL (${currencySymbol})`, 'SHARE (%)'],
    ...Object.entries(byCategory)
      .sort(([, a], [, b]) => b.total - a.total)
      .map(([cat, info]) => [
        cat,
        info.count,
        Number(info.total.toFixed(2)),
        totalOpEx > 0 ? `${((info.total / totalOpEx) * 100).toFixed(1)}%` : '0.0%'
      ])
  ];

  const cleanCompanyName = companyName.replace(/[^a-zA-Z0-9_-]/g, '_');
  return writeXlsxFile([
    {
      sheet: 'Expense Ledger',
      data: recordsToSheetData(rows),
      columns: [
        { width: 12 },
        { width: 18 },
        { width: 28 },
        { width: 24 },
        { width: 36 },
        { width: 22 },
        { width: 16 },
        { width: 12 },
        { width: 26 }
      ]
    },
    {
      sheet: 'OpEx Summary',
      data: aoaToSheetData(summaryRows),
      columns: [{ width: 32 }, { width: 12 }, { width: 18 }, { width: 14 }]
    }
  ]).toFile(`${cleanCompanyName}_Expense_Ledger_${dateStr}.xlsx`);
}

export function exportExpensesToPdf({
  expenses,
  companyName = 'Amansocean Seafoods',
  currencySymbol = '$'
}: ExportExpensesOptions): void {
  const dateStr = new Date().toISOString().split('T')[0];
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 68, 'F');
  doc.setFillColor(225, 29, 72); // rose-600
  doc.rect(0, 68, pageWidth, 4, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(`${companyName.toUpperCase()} • OPERATING EXPENSE LEDGER & HISTORY`, 28, 30);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text('Supabase-Verified Operating Disbursements, Logistics, Utilities & Facility Costs', 28, 48);

  doc.setFont('helvetica', 'bold');
  doc.text(`DATE: ${dateStr}`, pageWidth - 140, 30);
  doc.setFont('helvetica', 'normal');
  doc.text(`ENTRIES: ${expenses.length}`, pageWidth - 140, 48);

  const totalOpEx = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const settledTotal = expenses.filter(e => e.status === 'Settled').reduce((s, e) => s + (Number(e.amount) || 0), 0);

  doc.setFillColor(241, 245, 249);
  doc.roundedRect(28, 80, pageWidth - 56, 30, 4, 4, 'F');

  doc.setTextColor(51, 65, 85);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Total OpEx:', 40, 99);
  doc.setTextColor(190, 18, 60);
  doc.text(formatMoney(totalOpEx, currencySymbol), 100, 99);

  doc.setTextColor(51, 65, 85);
  doc.text('Settled:', 260, 99);
  doc.setTextColor(5, 150, 105);
  doc.text(formatMoney(settledTotal, currencySymbol), 305, 99);

  doc.setTextColor(51, 65, 85);
  doc.text('Records:', 460, 99);
  doc.setTextColor(15, 23, 42);
  doc.text(`${expenses.length} Expense(s)`, 508, 99);

  const tableData = expenses.map(exp => [
    formatDate(exp.date),
    exp.voucherNumber || exp.referenceId || exp.id,
    exp.category,
    exp.entityName || 'Operational Vendor',
    exp.description,
    exp.paymentMethod,
    exp.status,
    formatMoney(exp.amount, currencySymbol)
  ]);

  autoTable(doc, {
    startY: 118,
    margin: { left: 28, right: 28 },
    head: [[
      'Date',
      'Ref / Voucher #',
      'Category',
      'Vendor / Payee',
      'Description / Memo',
      'Payment Method',
      'Status',
      'Amount'
    ]],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 4.5,
      textColor: [30, 41, 59]
    },
    columnStyles: {
      0: { cellWidth: 62 },
      1: { cellWidth: 85, fontStyle: 'bold' },
      2: { cellWidth: 120 },
      3: { cellWidth: 110 },
      4: { cellWidth: 185 },
      5: { cellWidth: 90 },
      6: { cellWidth: 55, halign: 'center' },
      7: { cellWidth: 78, halign: 'right', fontStyle: 'bold', textColor: [190, 18, 60] }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    didDrawPage: (data) => {
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Frostly Seafood ERP • Operating Expense Ledger • Page ${data.pageNumber}`,
        28,
        pageHeight - 16
      );
    }
  });

  const cleanCompanyName = companyName.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`${cleanCompanyName}_Expense_Ledger_${dateStr}.pdf`);
}


