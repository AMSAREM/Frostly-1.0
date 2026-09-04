import { BaseRepository } from './base';
import { InventoryBatch } from '../types';
import { batchMapper, DatabaseInventoryBatchRow } from '../mappers/batchMapper';

export class BatchRepository extends BaseRepository<InventoryBatch, DatabaseInventoryBatchRow> {
  constructor() {
    super({
      tableName: 'inventory_batches',
      storageKey: 'frostly_batches_v3',
      toDomain: batchMapper.toDomain,
      toDatabase: batchMapper.toDatabase,
      getId: (batch) => batch.id,
    });
  }

  /**
   * Helper to fetch all inventory batches with fallback support
   */
  public async getBatches(fallback: InventoryBatch[] = []): Promise<InventoryBatch[]> {
    return this.getAll(fallback);
  }

  /**
   * Update weights for allocations or fulfillment
   */
  public async updateWeights(
    id: string,
    availableWeightKg: number,
    allocatedWeightKg: number
  ): Promise<InventoryBatch | null> {
    const existing = await this.getById(id);
    if (!existing) return null;

    const updated: InventoryBatch = {
      ...existing,
      availableWeightKg,
      allocatedWeightKg,
    };

    return this.save(updated, false);
  }
}

export const batchRepository = new BatchRepository();
