import { BaseRepository } from './base';
import { ClientOrder } from '../types';
import { orderMapper, DatabaseOrderRow, normalizeQualityGrade } from '../mappers/orderMapper';
import { supabase } from '../utils/supabase';
import { erpServerQuery, erpServerUpsert } from '../services/erpPersistenceClient';

export class OrderRepository extends BaseRepository<ClientOrder, DatabaseOrderRow> {
  constructor() {
    super({
      tableName: 'client_orders',
      storageKey: 'frostly_orders_v3',
      toDomain: orderMapper.toDomain,
      toDatabase: orderMapper.toDatabase,
      getId: (order) => order.id,
      onConflict: 'organization_id,id',
    });
  }

  public async getOrders(fallback: ClientOrder[] = []): Promise<ClientOrder[]> {
    const orgId = await this.getOrganizationId();
    const canQuery = await this.canAccessSupabase();
    if (canQuery) {
      try {
        const serverRes = await erpServerQuery<DatabaseOrderRow>({
          tableName: 'client_orders',
          organizationId: orgId,
          includeChildren: true,
        });
        if (serverRes.handled && !serverRes.error && Array.isArray(serverRes.rows)) {
          const domainItems = serverRes.rows.map((row) => this.toDomain(row));
          this.setLocalCache(domainItems, orgId);
          return domainItems;
        }

        let query = supabase
          .from('client_orders')
          .select('*, order_line_items(*)')
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
        console.warn('[OrderRepository] Fallback to base getAll:', e);
      }
    }
    return this.getAll(fallback);
  }

  public async saveOrderWithItems(order: ClientOrder): Promise<ClientOrder> {
    const orgId = await this.getOrganizationId();
    const itemsPayload = (order.items || []).map((item) => ({
      organization_id: orgId,
      order_id: order.id,
      species_id: item.speciesId || 'spec-tilapia',
      species_name: item.speciesName || 'Seafood Catch',
      grade: normalizeQualityGrade(item.grade),
      lot_id: item.lotId || `LOT-ORD-${order.id}`,
      requested_weight_kg: Math.max(0, Number(item.requestedWeightKg) || 0),
      actual_weighed_kg:
        item.actualWeighedKg !== undefined && item.actualWeighedKg !== null
          ? Number(item.actualWeighedKg)
          : null,
      price_per_kg: Math.max(0, Number(item.pricePerKg) || 0),
      notes: item.notes || null,
    }));

    const canQuery = await this.canAccessSupabase();
    if (canQuery) {
      const serverRes = await erpServerUpsert({
        tableName: 'client_orders',
        payload: { ...this.toDatabase(order), organization_id: orgId },
        onConflict: this.onConflict,
        organizationId: orgId,
        childItems: itemsPayload,
      });

      if (serverRes.handled && !serverRes.error) {
        const current = this.getLocalCache([], orgId);
        const idx = current.findIndex((o) => o.id === order.id);
        const updated =
          idx >= 0 ? current.map((o, i) => (i === idx ? order : o)) : [order, ...current];
        this.setLocalCache(updated, orgId);
        return order;
      }
    }

    const saved = await this.save(order);

    if (canQuery && itemsPayload.length > 0) {
      try {
        await supabase
          .from('order_line_items')
          .delete()
          .eq('order_id', order.id)
          .eq('organization_id', orgId);
        await supabase.from('order_line_items').insert(itemsPayload);
      } catch (err) {
        console.warn('[OrderRepository] line items sync note:', err);
      }
    }

    return saved;
  }
}

export const orderRepository = new OrderRepository();
