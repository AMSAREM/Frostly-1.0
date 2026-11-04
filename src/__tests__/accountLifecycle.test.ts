import { describe, it, expect, beforeEach } from 'vitest';
import { Customer, Supplier, ClientOrder, PurchaseOrderLanding } from '../types';

describe('Customer & Supplier Account Lifecycle: Blacklist, Close, Reactivate & Deletion Guards', () => {
  let mockCustomer: Customer;
  let mockSupplier: Supplier;
  let mockOrders: ClientOrder[];
  let mockPurchaseOrders: PurchaseOrderLanding[];

  beforeEach(() => {
    mockCustomer = {
      id: 'CUST-TEST-1',
      name: 'Pacific Catch Bistro',
      companyName: 'Pacific Catch Group',
      type: 'Wholesale Restaurant',
      tier: 'Tier 2 (Standard Wholesale)',
      contactPerson: 'Head Chef Marcus',
      email: 'marcus@pacificcatch.com',
      phone: '+1 415 555 0199',
      address: 'Pier 39 Dockside',
      city: 'San Francisco, CA',
      creditLimitUSD: 50000,
      outstandingBalanceUSD: 3500,
      paymentTerms: 'Net-30',
      totalOrdersCount: 12,
      totalSpendUSD: 48000,
      status: 'Active',
      joinedDate: '2025-01-15'
    };

    mockSupplier = {
      id: 'SUP-TEST-1',
      name: 'Cape Flattery Fishermen Co-op',
      contactPerson: 'Captain Lars',
      type: 'Fishermen Co-op',
      email: 'lars@capeflattery.org',
      phone: '+1 360 555 0144',
      portLocation: 'Neah Bay, WA',
      country: 'USA',
      vesselNames: ['FV Ocean Wanderer', 'FV Storm Petrel'],
      suppliedSpecies: ['Pacific Halibut', 'Sablefish'],
      paymentTerms: 'Net-15',
      outstandingPayableUSD: 8500,
      totalPurchasedUSD: 94000,
      totalWeightSuppliedKg: 8200,
      rating: 4.9,
      status: 'Active'
    };

    mockOrders = [
      {
        id: 'ORD-9001',
        customerId: 'CUST-TEST-1',
        clientName: 'Pacific Catch Bistro',
        clientCategory: 'Seafood Wholesaler',
        contactPerson: 'Chef Laurent',
        contactEmail: 'laurent@pacificcatch.com',
        contactPhone: '+1 (415) 555-0199',
        deliveryAddress: '800 Embarcadero St, Pier 39',
        destinationCity: 'San Francisco, CA',
        requiredDeliveryDate: '2026-11-03',
        orderDate: '2026-11-01',
        status: 'Weighing & Grading',
        paymentStatus: 'Pending Net-30',
        items: [],
        quotedTotalUSD: 3500,
        adjustedTotalUSD: null,
        packagingRequirement: 'Dry Ice & Insulated Wax Carton',
        packingSlipGenerated: false
      }
    ];

    mockPurchaseOrders = [
      {
        id: 'PO-8901',
        supplierId: 'SUP-TEST-1',
        supplierName: 'Cape Flattery Fishermen Co-op',
        vesselName: 'FV Ocean Wanderer',
        portLocation: 'Neah Bay, WA',
        orderDate: '2026-11-01',
        deliveryDate: '2026-11-02',
        lotAssignedId: 'LOT-2026-HALI-1001',
        speciesItems: [
          {
            speciesName: 'Pacific Halibut',
            weightKg: 200,
            costPerKg: 18.5,
            totalCost: 3700,
            grade: 'Grade #1',
            storageZone: 'Commercial Cold Storage (-22°C)'
          }
        ],
        totalCostUSD: 3700,
        paymentStatus: 'Pending Settlement',
        paymentDueDate: '2026-11-15',
        receivedBy: 'Dockmaster Alex',
        status: 'Received & In Stock'
      }
    ];
  });

  describe('Customer Blacklist & Close Safeguards', () => {
    it('supports transitioning customer to Blacklisted with notes', () => {
      const blacklistedCustomer: Customer = {
        ...mockCustomer,
        status: 'Blacklisted',
        statusReason: 'Unpaid delinquent balance exceeding 90 days',
        statusUpdatedAt: new Date().toISOString()
      };

      expect(blacklistedCustomer.status).toBe('Blacklisted');
      expect(blacklistedCustomer.statusReason).toContain('Unpaid delinquent balance');
    });

    it('supports transitioning customer to Closed', () => {
      const closedCustomer: Customer = {
        ...mockCustomer,
        status: 'Closed',
        statusReason: 'Client ceased commercial operations',
        statusUpdatedAt: new Date().toISOString()
      };

      expect(closedCustomer.status).toBe('Closed');
    });

    it('supports reactivating Blacklisted customer back to Active', () => {
      const blacklistedCustomer: Customer = { ...mockCustomer, status: 'Blacklisted' };
      const reactivated: Customer = {
        ...blacklistedCustomer,
        status: 'Active',
        statusReason: 'Payment agreement reached with finance'
      };

      expect(reactivated.status).toBe('Active');
    });

    it('blocks order creation if customer is Blacklisted or Closed', () => {
      const checkOrderAllowed = (cust: Customer) => {
        if (cust.status === 'Blacklisted') return { allowed: false, error: 'Customer is BLACKLISTED' };
        if (cust.status === 'Closed') return { allowed: false, error: 'Customer is CLOSED' };
        return { allowed: true };
      };

      expect(checkOrderAllowed({ ...mockCustomer, status: 'Blacklisted' }).allowed).toBe(false);
      expect(checkOrderAllowed({ ...mockCustomer, status: 'Closed' }).allowed).toBe(false);
      expect(checkOrderAllowed({ ...mockCustomer, status: 'Active' }).allowed).toBe(true);
    });
  });

  describe('Customer Deletion Guardrail', () => {
    const evaluateCustomerDeletionBlockers = (customer: Customer, orders: ClientOrder[]) => {
      const hasBalance = (customer.outstandingBalanceUSD || 0) > 0.01;
      const openOrders = orders.filter(
        (o) =>
          o.customerId === customer.id &&
          o.status !== 'Delivered' &&
          o.status !== 'Cancelled' &&
          o.status !== 'Voided'
      );
      const isBlocked = hasBalance || openOrders.length > 0;
      return { isBlocked, hasBalance, openOrdersCount: openOrders.length };
    };

    it('blocks customer deletion when customer has an outstanding balance', () => {
      const { isBlocked, hasBalance } = evaluateCustomerDeletionBlockers(mockCustomer, []);
      expect(isBlocked).toBe(true);
      expect(hasBalance).toBe(true);
    });

    it('blocks customer deletion when open orders exist even if balance is 0', () => {
      const zeroBalanceCustomer = { ...mockCustomer, outstandingBalanceUSD: 0 };
      const { isBlocked, openOrdersCount } = evaluateCustomerDeletionBlockers(zeroBalanceCustomer, mockOrders);
      expect(isBlocked).toBe(true);
      expect(openOrdersCount).toBe(1);
    });

    it('allows customer deletion only when balance is settled and no open orders exist', () => {
      const cleanCustomer = { ...mockCustomer, outstandingBalanceUSD: 0 };
      const closedOrders: ClientOrder[] = [
        { ...mockOrders[0], status: 'Delivered', paymentStatus: 'Paid' }
      ];
      const { isBlocked } = evaluateCustomerDeletionBlockers(cleanCustomer, closedOrders);
      expect(isBlocked).toBe(false);
    });
  });

  describe('Supplier Blacklist, Close, & Deletion Guardrails', () => {
    it('supports setting supplier to Blacklisted or Closed', () => {
      const blacklistedSupplier: Supplier = {
        ...mockSupplier,
        status: 'Blacklisted',
        statusReason: 'HACCP cold chain violation'
      };
      expect(blacklistedSupplier.status).toBe('Blacklisted');

      const closedSupplier: Supplier = {
        ...mockSupplier,
        status: 'Closed',
        statusReason: 'Harvester vessel decommissioned'
      };
      expect(closedSupplier.status).toBe('Closed');
    });

    it('blocks inward catch PO creation for Blacklisted or Closed suppliers', () => {
      const checkPOCreationAllowed = (supplier: Supplier) => {
        if (supplier.status === 'Blacklisted') return { allowed: false, error: 'Supplier is BLACKLISTED' };
        if (supplier.status === 'Closed') return { allowed: false, error: 'Supplier is CLOSED' };
        return { allowed: true };
      };

      expect(checkPOCreationAllowed({ ...mockSupplier, status: 'Blacklisted' }).allowed).toBe(false);
      expect(checkPOCreationAllowed({ ...mockSupplier, status: 'Closed' }).allowed).toBe(false);
      expect(checkPOCreationAllowed({ ...mockSupplier, status: 'Active' }).allowed).toBe(true);
    });

    it('blocks supplier deletion when outstanding payables or unsettled POs exist', () => {
      const evaluateSupplierDeletionBlockers = (supplier: Supplier, purchaseOrders: PurchaseOrderLanding[]) => {
        const hasPayable = (supplier.outstandingPayableUSD || 0) > 0.01;
        const activePOs = purchaseOrders.filter(
          (po) => po.supplierId === supplier.id && po.paymentStatus !== 'Paid in Full'
        );
        const isBlocked = hasPayable || activePOs.length > 0;
        return { isBlocked, hasPayable, activePOsCount: activePOs.length };
      };

      // Case 1: Has payable ($8,500)
      const res1 = evaluateSupplierDeletionBlockers(mockSupplier, []);
      expect(res1.isBlocked).toBe(true);
      expect(res1.hasPayable).toBe(true);

      // Case 2: Zero payable but unsettled POs
      const zeroPayableSupplier = { ...mockSupplier, outstandingPayableUSD: 0 };
      const res2 = evaluateSupplierDeletionBlockers(zeroPayableSupplier, mockPurchaseOrders);
      expect(res2.isBlocked).toBe(true);
      expect(res2.activePOsCount).toBe(1);

      // Case 3: Fully settled and cleared
      const clearedPOs: PurchaseOrderLanding[] = [
        { ...mockPurchaseOrders[0], paymentStatus: 'Paid in Full' }
      ];
      const res3 = evaluateSupplierDeletionBlockers(zeroPayableSupplier, clearedPOs);
      expect(res3.isBlocked).toBe(false);
    });
  });
});
