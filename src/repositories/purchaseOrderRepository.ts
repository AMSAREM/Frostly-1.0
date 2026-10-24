import { BaseRepository } from './base';
import { PurchaseOrderLanding } from '../types';
import { purchaseOrderMapper, DatabasePurchaseOrderRow } from '../mappers/purchaseOrderMapper';
import { normalizeQualityGrade } from '../mappers/orderMapper';
import { supabase } from '../utils/supabase';
import { getSpeciesIdFromName } from '../utils/speciesHelper';
import { erpServerQuery, erpServerUpsert } from '../services/erpPersistenceClient';

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
        const serverRes = await erpServerQuery<DatabasePurchaseOrderRow>({
          tableName: 'purchase_order_landings',
          organizationId: orgId,
          includeChildren: true,
        });
        if (serverRes.handled && !serverRes.error && Array.isArray(serverRes.rows)) {
          const domainItems = serverRes.rows.map((row) => this.toDomain(row));
          this.setLocalCache(domainItems, orgId);
          return domainItems;
        }

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

  public async savePurchaseOrderWithItems(po: PurchaseOrderLanding): Promise<PurchaseOrderLanding> {
    const orgId = await this.getOrganizationId();
    const itemsPayload = (po.speciesItems || []).map((item) => ({
      organization_id: orgId,
      po_id: po.id,
      species_id: getSpeciesIdFromName(item.speciesName),
      species_name: item.speciesName,
      weight_kg: Math.max(0.01, Number(item.weightKg) || 1),
      cost_per_kg: Math.max(0, Number(item.costPerKg) || 0),
      total_cost: Math.max(0, Number(item.totalCost) || 0),
      grade: normalizeQualityGrade(item.grade),
      storage_zone: item.storageZone || 'Commercial Cold Storage (-22°C)',
    }));

    const canQuery = await this.canAccessSupabase();
    if (canQuery) {
      const serverRes = await erpServerUpsert({
        tableName: 'purchase_order_landings',
        payload: { ...this.toDatabase(po), organization_id: orgId },
        onConflict: this.onConflict,
        organizationId: orgId,
        childItems: itemsPayload,
      });

      if (serverRes.handled) {
        if (serverRes.error) {
          throw new Error(`[PurchaseOrderRepository] Save error: ${serverRes.error}`);
        }
        const current = this.getLocalCache([], orgId);
        const idx = current.findIndex((item) => item.id === po.id);
        const updated =
          idx >= 0 ? current.map((item, i) => (i === idx ? po : item)) : [po, ...current];
        this.setLocalCache(updated, orgId);
        return po;
      }

      // Direct fallback only when server route is unhandled
      const saved = await this.save(po);
      if (itemsPayload.length > 0) {
        const { error: delErr } = await supabase
          .from('purchase_order_items')
          .delete()
          .eq('po_id', po.id)
          .eq('organization_id', orgId);
        if (delErr) {
          throw new Error(`[PurchaseOrderRepository] Failed to clear items: ${delErr.message}`);
        }
        const { error: insErr } = await supabase.from('purchase_order_items').insert(itemsPayload);
        if (insErr) {
          throw new Error(`[PurchaseOrderRepository] Failed to insert items: ${insErr.message}`);
        }
      }
      return saved;
    }

    return this.save(po);
  }
}

export const purchaseOrderRepository = new PurchaseOrderRepository();
