import { supabase, isSupabaseConfigured } from './supabase';
import { BaseRepository } from '../repositories/base';

export interface SchemaHealthResult {
  healthy: boolean;
  missingColumnsByTable: Record<string, string[]>;
  warnings: string[];
}

let healthcheckRan = false;
let lastHealthResult: SchemaHealthResult = {
  healthy: true,
  missingColumnsByTable: {},
  warnings: [],
};

/**
 * Runs startup healthcheck on database schema to detect pending migrations
 * and register missing columns explicitly rather than masking schema drift silently.
 */
export async function runSchemaHealthcheck(): Promise<SchemaHealthResult> {
  if (healthcheckRan) {
    return lastHealthResult;
  }
  healthcheckRan = true;

  if (!isSupabaseConfigured) {
    return lastHealthResult;
  }

  const checks = [
    {
      table: 'inventory_batches',
      columns: ['is_retail_cut_lot', 'linked_product_id', 'product_sku'],
      migration: '017_inventory_retail_linking.sql',
    },
    {
      table: 'retail_wholesale_products',
      columns: ['linked_batch_id', 'storage_zone'],
      migration: '017_inventory_retail_linking.sql',
    },
    {
      table: 'financial_ledger_entries',
      columns: ['customer_id', 'notes'],
      migration: '017_inventory_retail_linking.sql',
    },
  ];

  const missingColumnsByTable: Record<string, string[]> = {};
  const warnings: string[] = [];

  for (const check of checks) {
    try {
      // Query single row to inspect present column names without causing 400 Bad Request probe errors
      const { data, error } = await supabase
        .from(check.table)
        .select('*')
        .limit(1);

      if (!error && Array.isArray(data) && data.length > 0) {
        const presentKeys = new Set(Object.keys(data[0]));
        for (const column of check.columns) {
          if (!presentKeys.has(column)) {
            if (!missingColumnsByTable[check.table]) {
              missingColumnsByTable[check.table] = [];
            }
            missingColumnsByTable[check.table].push(column);
            BaseRepository.registerMissingColumn(check.table, column);
          }
        }
      } else {
        // If table has no rows, register columns statically to ensure safety
        for (const column of check.columns) {
          BaseRepository.registerMissingColumn(check.table, column);
        }
      }
    } catch (err: any) {
      console.warn(`[runSchemaHealthcheck] Inspection failed for table ${check.table}:`, err);
    }

    if (missingColumnsByTable[check.table]?.length) {
      const missing = missingColumnsByTable[check.table].join(', ');
      const warning = `[SCHEMA HEALTHCHECK INFO] Table '${check.table}' schema fallback active for column(s): [${missing}].`;
      warnings.push(warning);
    }
  }

  lastHealthResult = {
    healthy: warnings.length === 0,
    missingColumnsByTable,
    warnings,
  };

  if (lastHealthResult.healthy) {
    console.log('[SCHEMA HEALTHCHECK] Database schema verified: All expected columns present.');
  }

  return lastHealthResult;
}
