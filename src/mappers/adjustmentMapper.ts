import { InventoryAdjustmentAccount, InventoryStockAdjustment } from '../types';

export interface DatabaseAdjustmentAccountRow {
  id: string;
  organization_id?: string;
  account_code: string;
  account_name: string;
  account_type: string;
  description?: string | null;
  is_default: boolean;
  is_active: boolean;
  balance_usd: number | string;
  created_at?: string;
  updated_at?: string;
}

export interface DatabaseStockAdjustmentRow {
  id: string;
  organization_id?: string;
  batch_id: string;
  species_name: string;
  previous_weight_kg: number | string;
  new_weight_kg: number | string;
  delta_weight_kg: number | string;
  unit_cost_usd: number | string;
  valuation_variance_usd: number | string;
  reason: string;
  adjustment_account_id?: string | null;
  adjustment_account_code: string;
  adjustment_account_name: string;
  financial_ledger_id?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at?: string;
}

export const adjustmentAccountMapper = {
  toDomain(row: DatabaseAdjustmentAccountRow): InventoryAdjustmentAccount {
    return {
      id: row.id,
      organizationId: row.organization_id,
      accountCode: row.account_code,
      accountName: row.account_name,
      accountType: (row.account_type as any) || 'COGS',
      description: row.description || '',
      isDefault: Boolean(row.is_default),
      isActive: row.is_active !== false,
      balanceUSD: Number(row.balance_usd ?? 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  },

  toDatabase(entity: InventoryAdjustmentAccount): Record<string, any> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entity.id);
    const payload: Record<string, any> = {
      account_code: entity.accountCode,
      account_name: entity.accountName,
      account_type: entity.accountType,
      description: entity.description,
      is_default: entity.isDefault,
      is_active: entity.isActive,
      balance_usd: Number(entity.balanceUSD ?? 0),
    };
    if (isUuid) {
      payload.id = entity.id;
    }
    if (entity.organizationId) {
      payload.organization_id = entity.organizationId;
    }
    return payload;
  }
};

export const stockAdjustmentMapper = {
  toDomain(row: DatabaseStockAdjustmentRow): InventoryStockAdjustment {
    return {
      id: row.id,
      organizationId: row.organization_id,
      batchId: row.batch_id,
      speciesName: row.species_name,
      previousWeightKg: Number(row.previous_weight_kg ?? 0),
      newWeightKg: Number(row.new_weight_kg ?? 0),
      deltaWeightKg: Number(row.delta_weight_kg ?? 0),
      unitCostUSD: Number(row.unit_cost_usd ?? 0),
      valuationVarianceUSD: Number(row.valuation_variance_usd ?? 0),
      reason: row.reason,
      adjustmentAccountId: row.adjustment_account_id || undefined,
      adjustmentAccountCode: row.adjustment_account_code,
      adjustmentAccountName: row.adjustment_account_name,
      financialLedgerId: row.financial_ledger_id || undefined,
      notes: row.notes || undefined,
      createdBy: row.created_by || undefined,
      createdAt: row.created_at || new Date().toISOString()
    };
  },

  toDatabase(entity: InventoryStockAdjustment): Record<string, any> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entity.id);
    const payload: Record<string, any> = {
      batch_id: entity.batchId,
      species_name: entity.speciesName,
      previous_weight_kg: entity.previousWeightKg,
      new_weight_kg: entity.newWeightKg,
      delta_weight_kg: entity.deltaWeightKg,
      unit_cost_usd: entity.unitCostUSD,
      valuation_variance_usd: entity.valuationVarianceUSD,
      reason: entity.reason,
      adjustment_account_id: entity.adjustmentAccountId || null,
      adjustment_account_code: entity.adjustmentAccountCode,
      adjustment_account_name: entity.adjustmentAccountName,
      financial_ledger_id: entity.financialLedgerId || null,
      notes: entity.notes || null,
      created_by: entity.createdBy || null
    };
    if (isUuid) {
      payload.id = entity.id;
    }
    if (entity.organizationId) {
      payload.organization_id = entity.organizationId;
    }
    return payload;
  }
};
