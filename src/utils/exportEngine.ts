import * as XLSX from 'xlsx';
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
}: ExportDualPricingOptions): void {
  const dateStr = new Date().toISOString().split('T')[0];
  const workbook = XLSX.utils.book_new();

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

  const catalogWorksheet = XLSX.utils.json_to_sheet(catalogRows);

  // Auto-fit column widths
  const colWidths = [
    { wch: 14 }, // SKU
    { wch: 32 }, // Product Name
    { wch: 24 }, // Cut Type
    { wch: 14 }, // Category
    { wch: 14 }, // Grade
    { wch: 22 }, // Origin
    { wch: 28 }, // Storage Zone
    { wch: 18 }, // Cost
    { wch: 18 }, // Wholesale
    { wch: 18 }, // Retail
    { wch: 16 }, // Wholesale Margin
    { wch: 16 }, // Retail Margin
    { wch: 14 }, // MOQ
    { wch: 20 }, // Pack Format
    { wch: 16 }, // Stock
    { wch: 20 }, // Total Value
    { wch: 22 }, // Linked Vault Lot
    { wch: 16 }  // Parity Status
  ];
  catalogWorksheet['!cols'] = colWidths;
  XLSX.utils.book_append_sheet(workbook, catalogWorksheet, 'Dual Price Catalog');

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

  const summaryWorksheet = XLSX.utils.aoa_to_sheet(summaryData);
  summaryWorksheet['!cols'] = [{ wch: 38 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Commercial Summary');

  const cleanCompanyName = companyName.replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(workbook, `${cleanCompanyName}_Dual_Pricing_Catalog_${dateStr}.xlsx`);
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
  products = [],
  companyName = 'Amansocean Seafoods',
  currencySymbol = '$'
}: ExportInventoryOptions): void {
  const dateStr = new Date().toISOString().split('T')[0];
  const workbook = XLSX.utils.book_new();

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

  const lotsWorksheet = XLSX.utils.json_to_sheet(lotRows);
  lotsWorksheet['!cols'] = [
    { wch: 18 }, // Lot ID
    { wch: 28 }, // Species
    { wch: 26 }, // Scientific
    { wch: 14 }, // Category
    { wch: 14 }, // Grade
    { wch: 28 }, // Storage Zone
    { wch: 16 }, // Current Temp
    { wch: 16 }, // Target Temp
    { wch: 20 }, // Available Weight
    { wch: 20 }, // Allocated Weight
    { wch: 20 }, // Initial Intake
    { wch: 16 }, // Cost / kg
    { wch: 18 }, // Wholesale / kg
    { wch: 18 }, // Lot Cost Basis
    { wch: 20 }, // Lot Commercial Value
    { wch: 18 }, // Estimated Profit
    { wch: 14 }, // Harvest Date
    { wch: 16 }, // Received Date
    { wch: 14 }, // Expiry Date
    { wch: 22 }, // Vessel Name
    { wch: 18 }, // Vessel Reg
    { wch: 24 }, // Landing Port
    { wch: 24 }, // FAO Area
    { wch: 16 }, // Inspection
    { wch: 18 }, // Histamine
    { wch: 18 }, // Product SKU
    { wch: 20 }, // Product ID
    { wch: 30 }  // Certifications
  ];
  XLSX.utils.book_append_sheet(workbook, lotsWorksheet, 'Vault Lots Master');

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

  const zoneWorksheet = XLSX.utils.json_to_sheet(zoneSummary);
  zoneWorksheet['!cols'] = [
    { wch: 32 },
    { wch: 16 },
    { wch: 24 },
    { wch: 26 },
    { wch: 24 },
    { wch: 26 }
  ];
  XLSX.utils.book_append_sheet(workbook, zoneWorksheet, 'Cold Zone Analytics');

  const cleanCompanyName = companyName.replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(workbook, `${cleanCompanyName}_Cold_Storage_Inventory_${dateStr}.xlsx`);
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
}: ExportOrdersOptions): void {
  const dateStr = new Date().toISOString().split('T')[0];
  const workbook = XLSX.utils.book_new();

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

  const worksheet = XLSX.utils.json_to_sheet(orderRows);
  worksheet['!cols'] = [
    { wch: 14 },
    { wch: 28 },
    { wch: 22 },
    { wch: 18 },
    { wch: 26 },
    { wch: 14 },
    { wch: 16 },
    { wch: 18 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 18 },
    { wch: 18 },
    { wch: 20 },
    { wch: 28 },
    { wch: 45 },
    { wch: 16 },
    { wch: 16 }
  ];
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Wholesale Orders');

  const cleanCompanyName = companyName.replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(workbook, `${cleanCompanyName}_Wholesale_Orders_${dateStr}.xlsx`);
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

