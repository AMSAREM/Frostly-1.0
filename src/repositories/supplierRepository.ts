import { BaseRepository } from './base';
import { Supplier } from '../types';
import { supplierMapper, DatabaseSupplierRow } from '../mappers/supplierMapper';

export class SupplierRepository extends BaseRepository<Supplier, DatabaseSupplierRow> {
  constructor() {
    super({
      tableName: 'suppliers',
      storageKey: 'frostly_suppliers_v3',
      toDomain: supplierMapper.toDomain,
      toDatabase: supplierMapper.toDatabase,
      getId: (supplier) => supplier.id,
    });
  }

  public async getSuppliers(fallback: Supplier[] = []): Promise<Supplier[]> {
    return this.getAll(fallback);
  }
}

export const supplierRepository = new SupplierRepository();
