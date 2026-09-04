import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { customerRepository } from '../customerRepository';
import { syncQueue } from '../../sync/queue';
import { Customer } from '../../types';

// Lightweight in-memory localStorage mock
const mockStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, value: string) => {
    mockStorage[key] = String(value);
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  clear: () => {
    for (const key in mockStorage) {
      delete mockStorage[key];
    }
  },
};

beforeAll(() => {
  vi.stubGlobal('localStorage', localStorageMock);
});

const sampleCustomer: Customer = {
  id: 'CUST-TEST-101',
  name: 'Nobu Seafood Bar',
  companyName: 'Nobu Hospitality Group',
  type: 'Wholesale Restaurant',
  tier: 'Tier 1 (VIP Wholesale -15%)',
  contactPerson: 'Chef Kenji',
  email: 'kenji@nobuseafood.com',
  phone: '+1 (415) 555-0199',
  address: 'Pier 39, Dock 4',
  city: 'San Francisco, CA',
  creditLimitUSD: 75000,
  outstandingBalanceUSD: 12000,
  paymentTerms: 'Net-30',
  totalOrdersCount: 14,
  totalSpendUSD: 154000,
  status: 'Active',
  taxId: 'US-94-118274',
  notes: 'Priority morning delivery required',
  joinedDate: '2026-01-15',
};

describe('CustomerRepository Unit Suite', () => {
  beforeEach(() => {
    localStorageMock.clear();
    syncQueue.clear();
    // Guarantee test runs offline so BaseRepository exercises local cache and sync queue
    vi.spyOn(customerRepository, 'canAccessSupabase').mockResolvedValue(false);
  });

  it('saves customer optimistically to localStorage cache', async () => {
    await customerRepository.save(sampleCustomer, true);

    const cached = customerRepository.getLocalCache();
    expect(cached).toHaveLength(1);
    expect(cached[0].id).toBe(sampleCustomer.id);
    expect(cached[0].name).toBe('Nobu Seafood Bar');
    expect(cached[0].creditLimitUSD).toBe(75000);
  });

  it('queues an INSERT operation to syncQueue when saving offline', async () => {
    await customerRepository.save(sampleCustomer, true);

    const queued = syncQueue.getAll();
    expect(queued).toHaveLength(1);
    expect(queued[0].tableName).toBe('customers');
    expect(queued[0].operation).toBe('INSERT');
    expect(queued[0].recordId).toBe(sampleCustomer.id);
    expect(queued[0].payload.name).toBe(sampleCustomer.name);
    expect(queued[0].payload.company_name).toBe(sampleCustomer.companyName);
  });

  it('retrieves customer by ID from local cache', async () => {
    await customerRepository.save(sampleCustomer, true);

    const retrieved = await customerRepository.getById('CUST-TEST-101');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.email).toBe('kenji@nobuseafood.com');
  });

  it('updates financials and preserves updated values in cache', async () => {
    await customerRepository.save(sampleCustomer, true);

    const updated = await customerRepository.updateFinancials(
      'CUST-TEST-101',
      18500, // new balance
      160500, // new total spend
      15 // new total orders
    );

    expect(updated).not.toBeNull();
    expect(updated?.outstandingBalanceUSD).toBe(18500);
    expect(updated?.totalSpendUSD).toBe(160500);
    expect(updated?.totalOrdersCount).toBe(15);

    const reRead = await customerRepository.getById('CUST-TEST-101');
    expect(reRead?.outstandingBalanceUSD).toBe(18500);
  });

  it('removes customer and enqueues DELETE operation', async () => {
    // Save existing customer initially (simulating synced record)
    customerRepository.resetCache([sampleCustomer]);

    await customerRepository.delete('CUST-TEST-101');

    const cached = customerRepository.getLocalCache();
    expect(cached).toHaveLength(0);

    const queued = syncQueue.getAll();
    const deleteOp = queued.find((op) => op.operation === 'DELETE');
    expect(deleteOp).toBeDefined();
    expect(deleteOp?.recordId).toBe('CUST-TEST-101');
  });
});
