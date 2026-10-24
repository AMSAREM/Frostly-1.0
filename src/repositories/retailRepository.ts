import { BaseRepository } from './base';
import { RetailWholesaleProduct, RetailTransaction } from '../types';
import {
  productMapper,
  retailTransactionMapper,
  DatabaseProductRow,
  DatabaseRetailTransactionRow,
  normalizeRetailCutType,
} from '../mappers/retailMapper';
import { supabase } from '../utils/supabase';
import { erpServerQuery, erpServerUpsert } from '../services/erpPersistenceClient';

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
        const serverRes = await erpServerQuery<DatabaseProductRow>({
          tableName: 'retail_wholesale_products',
          organizationId: orgId,
        });
        if (serverRes.handled && !serverRes.error && Array.isArray(serverRes.rows)) {
          const activeItems = serverRes.rows
            .filter((row: any) => row.is_active !== false && !LEGACY_DEMO_SET.has(String(row.id)))
            .map((row: any) => this.toDomain(row));
          this.setLocalCache(activeItems, orgId);
          return activeItems;
        }

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
        const serverRes = await erpServerQuery<DatabaseRetailTransactionRow>({
          tableName: 'retail_transactions',
          organizationId: orgId,
          includeChildren: true,
        });
        if (serverRes.handled && !serverRes.error && Array.isArray(serverRes.rows)) {
          const domainItems = serverRes.rows.map((row) => this.toDomain(row));
          this.setLocalCache(domainItems, orgId);
          return domainItems;
        }

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
    const orgId = await this.getOrganizationId();
    const itemsPayload = (sale.items || []).map((item) => ({
      organization_id: orgId,
      transaction_id: sale.id,
      product_id: item.productId,
      product_name: item.productName,
      cut_type: normalizeRetailCutType(item.cutType),
      quantity: Math.max(0.01, Number(item.quantity) || 1),
      unit: item.unit || 'kg',
      unit_price: Math.max(0, Number(item.unitPrice) || 0),
      cost_price: Math.max(0, Number(item.costPrice) || 0),
      line_total: Math.max(0, Number(item.lineTotal) || 0),
    }));

    const canQuery = await this.canAccessSupabase();
    if (canQuery) {
      const serverRes = await erpServerUpsert({
        tableName: 'retail_transactions',
        payload: { ...this.toDatabase(sale), organization_id: orgId },
        onConflict: this.onConflict,
        organizationId: orgId,
        childItems: itemsPayload,
      });

      if (serverRes.handled) {
        if (serverRes.error) {
          throw new Error(`[RetailTransactionRepository] Save error: ${serverRes.error}`);
        }
        const current = this.getLocalCache([], orgId);
        const idx = current.findIndex((tx) => tx.id === sale.id);
        const updated =
          idx >= 0 ? current.map((tx, i) => (i === idx ? sale : tx)) : [sale, ...current];
        this.setLocalCache(updated, orgId);
        return sale;
      }

      // Direct fallback only when server route is unhandled
      const saved = await this.save(sale);
      if (itemsPayload.length > 0) {
        const { error: delErr } = await supabase
          .from('retail_sale_items')
          .delete()
          .eq('transaction_id', sale.id)
          .eq('organization_id', orgId);
        if (delErr) {
          throw new Error(`[RetailTransactionRepository] Failed to clear items: ${delErr.message}`);
        }
        const { error: insErr } = await supabase.from('retail_sale_items').insert(itemsPayload);
        if (insErr) {
          throw new Error(`[RetailTransactionRepository] Failed to insert items: ${insErr.message}`);
        }
      }
      return saved;
    }

    return this.save(sale);
  }
}

export const productRepository = new ProductRepository();
export const retailTransactionRepository = new RetailTransactionRepository();
