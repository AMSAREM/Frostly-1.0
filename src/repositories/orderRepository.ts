import { BaseRepository } from './base';
import { ClientOrder } from '../types';
import { orderMapper, DatabaseOrderRow } from '../mappers/orderMapper';
import { supabase } from '../utils/supabase';

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
    const canQuery = await this.canAccessSupabase();
    if (canQuery) {
      try {
        const { data, error } = await supabase
          .from('client_orders')
          .select('*, order_line_items(*)')
          .order('order_date', { ascending: false });

        if (!error && data && data.length > 0) {
          const domainItems = data.map((row: any) => this.toDomain(row));
          this.setLocalCache(domainItems);
          return domainItems;
        }
      } catch (e) {
        console.warn('[OrderRepository] Fallback to base getAll:', e);
      }
    }
    return this.getAll(fallback);
  }

  public async saveOrderWithItems(order: ClientOrder): Promise<ClientOrder> {
    const saved = await this.save(order);
    
    // Also attempt saving line items if online
    const canQuery = await this.canAccessSupabase();
    if (canQuery && order.items && order.items.length > 0) {
      try {
        const itemsPayload = order.items.map(item => ({
          order_id: order.id,
          species_id: item.speciesId,
          species_name: item.speciesName,
          grade: item.grade,
          lot_id: item.lotId,
          requested_weight_kg: item.requestedWeightKg,
          actual_weighed_kg: item.actualWeighedKg,
          price_per_kg: item.pricePerKg,
          notes: item.notes || null,
        }));
        await supabase.from('order_line_items').delete().eq('order_id', order.id);
        await supabase.from('order_line_items').insert(itemsPayload);
      } catch (err) {
        console.warn('[OrderRepository] line items sync note:', err);
      }
    }

    return saved;
  }
}

export const orderRepository = new OrderRepository();
