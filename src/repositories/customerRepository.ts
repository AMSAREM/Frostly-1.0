import { BaseRepository } from './base';
import { Customer } from '../types';
import { customerMapper, DatabaseCustomerRow } from '../mappers/customerMapper';

export class CustomerRepository extends BaseRepository<Customer, DatabaseCustomerRow> {
  constructor() {
    super({
      tableName: 'customers',
      storageKey: 'frostly_customers_v3',
      toDomain: customerMapper.toDomain,
      toDatabase: customerMapper.toDatabase,
      getId: (customer) => customer.id,
    });
  }

  /**
   * Helper to fetch all customers with fallback support
   */
  public async getCustomers(fallback: Customer[] = []): Promise<Customer[]> {
    return this.getAll(fallback);
  }

  /**
   * Update balance or order counts
   */
  public async updateFinancials(
    id: string,
    outstandingBalanceUSD: number,
    totalSpendUSD: number,
    totalOrdersCount: number
  ): Promise<Customer | null> {
    const existing = await this.getById(id);
    if (!existing) return null;

    const updated: Customer = {
      ...existing,
      outstandingBalanceUSD,
      totalSpendUSD,
      totalOrdersCount,
    };

    return this.save(updated, false);
  }
}

export const customerRepository = new CustomerRepository();
