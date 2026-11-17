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
    const orgId = await this.getOrganizationId();
    const canQuery = await this.canAccessSupabase();
    if (canQuery) {
      try {
        let query = supabase
          .from('purchase_order_landings')
          .select('*, purchase_order_items(*)')
          .order('order_date', { ascending: false });

        if (orgId) {
          query = query.eq('organization_id', orgId);
        }

        const { data, error } = await query;

        if (!error && data) {
          const domainItems = data.map((row: any) => this.toDomain(row));
          this.setLocalCache(domainItems, orgId);
          return domainItems;
        }
      } catch (e) {
        console.warn('[PurchaseOrderRepository] Fallback to base getAll:', e);
      }
    }
    return this.getAll(fallback);
  }

  public async savePurchaseOrderWithItems(po: PurchaseOrderLanding, isNew = true): Promise<PurchaseOrderLanding> {
    const saved = await this.save(po, isNew);

    const canQuery = await this.canAccessSupabase();
    if (canQuery && po.speciesItems && po.speciesItems.length > 0) {
      try {
        const orgId = await this.getOrganizationId();

        let existingQuery = supabase
          .from('purchase_order_items')
          .select('id')
          .eq('po_id', po.id)
          .order('created_at', { ascending: true });
        if (orgId) {
          existingQuery = existingQuery.eq('organization_id', orgId);
        }

        const { data: existingRows } = await existingQuery;

        for (let idx = 0; idx < po.speciesItems.length; idx++) {
          const item = po.speciesItems[idx];
          const rowPayload: Record<string, any> = {
            po_id: po.id,
            species_id: getSpeciesIdFromName(item.speciesName),
            species_name: item.speciesName,
            weight_kg: item.weightKg,
            cost_per_kg: item.costPerKg,
            total_cost: item.totalCost,
            grade: item.grade,
            storage_zone: item.storageZone,
            ...(orgId ? { organization_id: orgId } : {}),
          };

          const existingRowId = existingRows && existingRows[idx]?.id;
          if (existingRowId) {
            let updateQuery = supabase
              .from('purchase_order_items')
              .update(rowPayload)
              .eq('id', existingRowId);
            if (orgId) {
              updateQuery = updateQuery.eq('organization_id', orgId);
            }
            const { error: updateErr } = await updateQuery;
            if (updateErr) {
              console.warn('[PurchaseOrderRepository] purchase order item update note:', updateErr.message);
            }
          } else {
            const { error: insertErr } = await supabase
              .from('purchase_order_items')
              .insert(rowPayload);
            if (insertErr) {
              console.warn('[PurchaseOrderRepository] purchase order item insert note:', insertErr.message);
            }
          }
        }
      } catch (err) {
        console.warn('[PurchaseOrderRepository] purchase order items sync note:', err);
      }
    }

    return saved;
  }
}

export const purchaseOrderRepository = new PurchaseOrderRepository();
