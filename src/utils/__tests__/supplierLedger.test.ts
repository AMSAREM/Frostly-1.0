import { describe, it, expect } from 'vitest';
import { buildSupplierLedger } from '../supplierLedger';
import { Supplier, PurchaseOrderLanding, FinancialLedgerEntry } from '../../types';

describe('Supplier AP Ledger Unit Suite', () => {
  const sampleSupplier: Supplier = {
    id: 'SUP-201',
    name: 'Puget Sound Salmon Co-op',
    contactPerson: 'Capt. James Peterson',
    type: 'Fishermen Co-op',
    email: 'dispatch@pugetsalmcoop.org',
    phone: '+1 (206) 555-0144',
    portLocation: 'Seattle Pier 91',
    country: 'USA',
    vesselNames: ['Northern Star', 'Arctic Wave'],
    suppliedSpecies: ['Wild King Salmon', 'Pacific Halibut'],
    paymentTerms: 'Net-15',
    outstandingPayableUSD: 16500,
    totalPurchasedUSD: 142000,
    totalWeightSuppliedKg: 8500,
    rating: 4.9,
    status: 'Preferred Partner',
    bankAccountRef: 'ACH-Routing-7749-Acct-1029',
    notes: 'MSC Certified fleet with deck bleed protocol'
  };

  const samplePOs: PurchaseOrderLanding[] = [
    {
      id: 'PO-8821',
      supplierId: 'SUP-201',
      supplierName: 'Puget Sound Salmon Co-op',
      vesselName: 'Northern Star',
      portLocation: 'Seattle Pier 91',
      orderDate: '2026-03-01',
      deliveryDate: '2026-03-01',
      speciesItems: [
        {
          speciesName: 'Wild King Salmon',
          weightKg: 500,
          costPerKg: 20,
          totalCost: 10000,
          grade: 'Grade #1',
          storageZone: 'Fresh Slush Ice (0°C to +2°C)'
        }
      ],
      totalCostUSD: 10000,
      paymentStatus: 'Paid in Full',
      paymentDueDate: '2026-03-16',
      receivedBy: 'Dock Receiving Master',
      lotAssignedId: 'LOT-2026-SALM-1001',
      status: 'Received & In Stock'
    },
    {
      id: 'PO-8822',
      supplierId: 'SUP-201',
      supplierName: 'Puget Sound Salmon Co-op',
      vesselName: 'Arctic Wave',
      portLocation: 'Seattle Pier 91',
      orderDate: '2026-03-15',
      deliveryDate: '2026-03-15',
      speciesItems: [
        {
          speciesName: 'Pacific Halibut',
          weightKg: 750,
          costPerKg: 22,
          totalCost: 16500,
          grade: 'Sashimi AAA',
          storageZone: 'Super-Cryo Deep Freeze (-60°C)'
        }
      ],
      totalCostUSD: 16500,
      paymentStatus: 'Pending Settlement',
      paymentDueDate: '2026-03-30',
      receivedBy: 'Dock Receiving Master',
      lotAssignedId: 'LOT-2026-HALI-1002',
      status: 'Received & In Stock'
    }
  ];

  const sampleFinancialEntries: FinancialLedgerEntry[] = [
    {
      id: 'FIN-1001',
      date: '2026-03-05',
      type: 'COGS',
      category: 'COGS (Catch Intake)',
      description: 'Harvester AP Settlement Wire - Puget Sound Salmon Co-op',
      referenceId: 'VOUCH-8821',
      entityName: 'Puget Sound Salmon Co-op',
      amount: 10000,
      paymentMethod: 'Federal Wire Transfer / ACH',
      status: 'Settled',
      supplierId: 'SUP-201',
      voucherNumber: 'VOUCH-8821'
    }
  ];

  it('builds chronological AP ledger with correct Bills and Disbursements', () => {
    const { entries, summary } = buildSupplierLedger(sampleSupplier, samplePOs, sampleFinancialEntries);

    expect(entries).toHaveLength(3);
    // Newest is first
    expect(entries[0].type).toBe('Bill');
    expect(entries[0].referenceId).toBe('PO-8822');
    expect(entries[0].credit).toBe(16500);
    expect(entries[0].debit).toBe(0);
    expect(entries[0].runningBalance).toBe(16500);

    // Middle entry is payment for PO-8821
    expect(entries[1].type).toBe('Disbursement');
    expect(entries[1].referenceId).toBe('VOUCH-8821');
    expect(entries[1].debit).toBe(10000);
    expect(entries[1].credit).toBe(0);
    expect(entries[1].runningBalance).toBe(0);

    // Oldest entry is initial bill PO-8821
    expect(entries[2].type).toBe('Bill');
    expect(entries[2].referenceId).toBe('PO-8821');
    expect(entries[2].credit).toBe(10000);
    expect(entries[2].runningBalance).toBe(10000);

    // Verify summary KPIs
    expect(summary.totalBilledUSD).toBe(26500);
    expect(summary.totalDisbursedUSD).toBe(10000);
    expect(summary.outstandingPayableUSD).toBe(16500);
    expect(summary.openBillsCount).toBe(1);
    expect(summary.settledBillsCount).toBe(1);
    expect(summary.disbursementsCount).toBe(1);
    expect(summary.lastPaymentAmount).toBe(10000);
    expect(summary.lastPaymentDate).toBe('2026-03-05');
  });

  it('correctly calculates running balance with disbursement reversals', () => {
    const entriesWithReversal: FinancialLedgerEntry[] = [
      ...sampleFinancialEntries,
      {
        id: 'FIN-1002',
        date: '2026-03-06',
        type: 'COGS',
        category: 'COGS (Catch Intake)',
        description: 'Disbursement Reversal - Bounced wire recalled',
        referenceId: 'REV-FIN-1001',
        entityName: 'Puget Sound Salmon Co-op',
        amount: 10000,
        paymentMethod: 'Wire Recall / Void',
        status: 'Settled',
        supplierId: 'SUP-201',
        voucherNumber: 'REV-FIN-1001'
      }
    ];

    const { entries } = buildSupplierLedger(sampleSupplier, samplePOs, entriesWithReversal);

    expect(entries).toHaveLength(4);
    const reversal = entries.find(e => e.type === 'Reversal');
    expect(reversal).toBeDefined();
    expect(reversal?.credit).toBe(10000);
    expect(reversal?.debit).toBe(0);
    expect(reversal?.status).toBe('Reversed');
  });
});
