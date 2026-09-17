import { BaseRepository } from './base';
import { PurchaseOrderLanding } from '../types';
import { purchaseOrderMapper, DatabasePurchaseOrderRow } from '../mappers/purchaseOrderMapper';
import { supabase } from '../utils/supabase';
import { getSpeciesIdFromName } from '../utils/speciesHelper';

export class PurchaseOrderRepository extends BaseRepository<PurchaseOrderLanding, DatabasePurchaseOrderRow> {
  constructor() {
    super({
      tableName: 'purchase_order_landings',
      storageKey: 'frostly_purchase_orders_v3',
      toDomain: purchaseOrderMapper.toDomain,
      toDatabase: purchaseOrderMapper.toDatabase,
      getId: (po) => po.id,
      onConflict: 'organization_id,id',
    });
  }

  public async getPurchaseOrders(fallback: PurchaseOrderLanding[] = []): Promise<PurchaseOrderLanding[]> {
    const canQuery = await this.canAccessSupabase();
    if (canQuery) {
      try {
        const { data, error } = await supabase
          .from('purchase_order_landings')
          .select('*, purchase_order_items(*)')
          .order('order_date', { ascending: false });

        if (!error && data && data.length > 0) {
          const domainItems = data.map((row: any) => this.toDomain(row));
          this.setLocalCache(domainItems);
          return domainItems;
        }
      } catch (e) {
        console.warn('[PurchaseOrderRepository] Fallback to base getAll:', e);
      }
    }
    return this.getAll(fallback);
  }

  public async savePurchaseOrderWithItems(po: PurchaseOrderLanding): Promise<PurchaseOrderLanding> {
    const saved = await this.save(po);

    const canQuery = await this.canAccessSupabase();
    if (canQuery && po.speciesItems && po.speciesItems.length > 0) {
      try {
        const itemsPayload = po.speciesItems.map((item) => ({
          po_id: po.id,
          species_id: getSpeciesIdFromName(item.speciesName),
          species_name: item.speciesName,
          weight_kg: item.weightKg,
          cost_per_kg: item.costPerKg,
          total_cost: item.totalCost,
          grade: item.grade,
          storage_zone: item.storageZone,
        }));
        await supabase.from('purchase_order_items').delete().eq('po_id', po.id);
        await supabase.from('purchase_order_items').insert(itemsPayload);
      } catch (err) {
        console.warn('[PurchaseOrderRepository] purchase order items sync note:', err);
      }
    }

    return saved;
  }
}

export const purchaseOrderRepository = new PurchaseOrderRepository();
