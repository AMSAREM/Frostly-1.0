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
  ];

  const missingColumnsByTable: Record<string, string[]> = {};
  const warnings: string[] = [];

  for (const check of checks) {
    for (const column of check.columns) {
      try {
        const { error } = await supabase
          .from(check.table)
          .select(column)
          .limit(0);

        if (error) {
          if (
            error.message?.includes('in the schema cache') ||
            error.message?.includes("Could not find the '") ||
            error.message?.includes(`column ${check.table}.${column} does not exist`)
          ) {
            if (!missingColumnsByTable[check.table]) {
              missingColumnsByTable[check.table] = [];
            }
            missingColumnsByTable[check.table].push(column);
            BaseRepository.registerMissingColumn(check.table, column);
          }
        }
      } catch (err: any) {
        console.warn(`[runSchemaHealthcheck] Failed check for ${check.table}.${column}:`, err);
      }
    }

    if (missingColumnsByTable[check.table]?.length) {
      const missing = missingColumnsByTable[check.table].join(', ');
      const warning = `[SCHEMA HEALTHCHECK WARNING] Table '${check.table}' is missing column(s): [${missing}]. Apply pending database migration '${check.migration}' in Supabase.`;
      warnings.push(warning);
      console.warn(warning);
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
