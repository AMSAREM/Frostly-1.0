import { BaseRepository } from './base';
import { RetailWholesaleProduct, RetailTransaction } from '../types';
import { productMapper, retailTransactionMapper, DatabaseProductRow, DatabaseRetailTransactionRow } from '../mappers/retailMapper';
import { supabase } from '../utils/supabase';

import { LEGACY_DEMO_PRODUCT_IDS } from '../data/amansoceanProducts';

const LEGACY_DEMO_SET = new Set<string>(LEGACY_DEMO_PRODUCT_IDS);

export class ProductRepository extends BaseRepository<RetailWholesaleProduct, DatabaseProductRow> {
  constructor() {
    super({
      tableName: 'retail_wholesale_products',
      storageKey: 'frostly_products_v4_ghs',
      toDomain: productMapper.toDomain,
      toDatabase: productMapper.toDatabase,
      getId: (prod) => prod.id,
      onConflict: 'organization_id,id',
    });
  }

  public async getProducts(fallback: RetailWholesaleProduct[] = []): Promise<RetailWholesaleProduct[]> {
    const orgId = await this.getOrganizationId();
    const canQuery = await this.canAccessSupabase();
    if (canQuery) {
      try {
        let query = supabase
          .from('retail_wholesale_products')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: true });

        if (orgId) {
          query = query.eq('organization_id', orgId);
        }

        const { data, error } = await query;
        if (!error && Array.isArray(data)) {
          const activeItems = data
            .filter((row: any) => row.is_active !== false && !LEGACY_DEMO_SET.has(String(row.id)))
            .map((row: any) => this.toDomain(row));
          this.setLocalCache(activeItems, orgId);
          return activeItems;
        }
      } catch (err) {
        console.warn('[ProductRepository] Fallback to base getAll:', err);
      }
    }

    const items = await this.getAll(fallback);
    return items.filter((item) => !LEGACY_DEMO_SET.has(item.id));
  }
}

export class RetailTransactionRepository extends BaseRepository<RetailTransaction, DatabaseRetailTransactionRow> {
  constructor() {
    super({
      tableName: 'retail_transactions',
      storageKey: 'frostly_retail_transactions_v3',
      toDomain: retailTransactionMapper.toDomain,
      toDatabase: retailTransactionMapper.toDatabase,
      getId: (tx) => tx.id,
      onConflict: 'organization_id,id',
    });
  }

  public async getTransactions(fallback: RetailTransaction[] = []): Promise<RetailTransaction[]> {
    const orgId = await this.getOrganizationId();
    const canQuery = await this.canAccessSupabase();
    if (canQuery) {
      try {
        let query = supabase
          .from('retail_transactions')
          .select('*, retail_sale_items(*)')
          .order('created_at', { ascending: false });

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
        console.warn('[RetailTransactionRepository] Fallback to base getAll:', e);
      }
    }
    return this.getAll(fallback);
  }

  public async recordSaleWithItems(sale: RetailTransaction): Promise<RetailTransaction> {
    const saved = await this.save(sale);

    const canQuery = await this.canAccessSupabase();
    if (canQuery && sale.items && sale.items.length > 0) {
      try {
        const itemsPayload = sale.items.map((item) => ({
          transaction_id: sale.id,
          product_id: item.productId,
          product_name: item.productName,
          cut_type: item.cutType,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unitPrice,
          cost_price: item.costPrice,
          line_total: item.lineTotal,
        }));
        await supabase.from('retail_sale_items').delete().eq('transaction_id', sale.id);
        await supabase.from('retail_sale_items').insert(itemsPayload);
      } catch (err) {
        console.warn('[RetailTransactionRepository] retail sale items sync note:', err);
      }
    }

    return saved;
  }
}

export const productRepository = new ProductRepository();
export const retailTransactionRepository = new RetailTransactionRepository();
