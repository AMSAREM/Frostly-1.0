import { BaseRepository } from './base';
import { InventoryAdjustmentAccount, InventoryStockAdjustment, FinancialLedgerEntry } from '../types';
import { 
  adjustmentAccountMapper, 
  stockAdjustmentMapper, 
  DatabaseAdjustmentAccountRow, 
  DatabaseStockAdjustmentRow 
} from '../mappers/adjustmentMapper';
import { supabase } from '../utils/supabase';
import { financialRepository } from './financialRepository';

export class AdjustmentAccountRepository extends BaseRepository<InventoryAdjustmentAccount, DatabaseAdjustmentAccountRow> {
  constructor() {
    super({
      tableName: 'inventory_adjustment_accounts',
      storageKey: 'frostly_adj_accounts_v1',
      toDomain: adjustmentAccountMapper.toDomain,
      toDatabase: adjustmentAccountMapper.toDatabase,
      getId: (acc) => acc.id,
      onConflict: 'organization_id,account_code',
    });
  }

  public async getAccounts(fallback: InventoryAdjustmentAccount[] = []): Promise<InventoryAdjustmentAccount[]> {
    return this.getAll(fallback);
  }

  public async saveAccount(account: InventoryAdjustmentAccount): Promise<InventoryAdjustmentAccount> {
    return this.save(account);
  }

  public async updateBalance(accountId: string, deltaAmount: number): Promise<void> {
    try {
      const accounts = await this.getAccounts();
      const target = accounts.find(a => a.id === accountId || a.accountCode === accountId);
      if (target) {
        target.balanceUSD = Number(((target.balanceUSD || 0) + deltaAmount).toFixed(2));
        target.updatedAt = new Date().toISOString();
        await this.save(target);
      }
    } catch (err) {
      console.warn('[AdjustmentAccountRepository] updateBalance error:', err);
    }
  }
}

export class StockAdjustmentRepository extends BaseRepository<InventoryStockAdjustment, DatabaseStockAdjustmentRow> {
  constructor() {
    super({
      tableName: 'inventory_adjustments',
      storageKey: 'frostly_stock_adjustments_v1',
      toDomain: stockAdjustmentMapper.toDomain,
      toDatabase: stockAdjustmentMapper.toDatabase,
      getId: (adj) => adj.id,
      onConflict: 'organization_id,id',
    });
  }

  public async getAdjustments(fallback: InventoryStockAdjustment[] = []): Promise<InventoryStockAdjustment[]> {
    return this.getAll(fallback);
  }

  /**
   * Records a stock adjustment in Supabase database, updates the linked adjustment account balance,
   * and automatically posts the valuation variance to the general financial ledger.
   */
  public async recordAdjustment(
    adjustment: InventoryStockAdjustment,
    autoPostLedger: boolean = true
  ): Promise<{
    adjustment: InventoryStockAdjustment;
    financialEntry?: FinancialLedgerEntry;
  }> {
    const orgId = await this.getOrganizationId();
    let savedFinancialEntry: FinancialLedgerEntry | undefined;

    // 1. Post to Financial Ledger if enabled and there is financial variance
    if (autoPostLedger && Math.abs(adjustment.valuationVarianceUSD) > 0.001) {
      const isLoss = adjustment.valuationVarianceUSD < 0;
      const absVariance = Math.abs(adjustment.valuationVarianceUSD);

      // Unique reference for the financial ledger
      const finId = `FIN-ADJ-${Date.now().toString().slice(-6)}`;
      const financialEntry: FinancialLedgerEntry = {
        id: finId,
        date: new Date().toISOString().split('T')[0],
        type: isLoss ? 'COGS' : 'Income',
        category: 'Inventory Adjustment',
        description: `Inventory Lot ${adjustment.batchId} Adjustment (${adjustment.reason}) - ${adjustment.adjustmentAccountCode} ${adjustment.adjustmentAccountName}`,
        referenceId: adjustment.batchId,
        entityName: `Internal Cold Vault [Acc ${adjustment.adjustmentAccountCode}]`,
        amount: absVariance,
        paymentMethod: `Adjustment Account ${adjustment.adjustmentAccountCode}`,
        status: 'Settled',
      };

      try {
        savedFinancialEntry = await financialRepository.addEntry(financialEntry);
        if (savedFinancialEntry?.id) {
          adjustment.financialLedgerId = savedFinancialEntry.id;
        }
      } catch (err) {
        console.warn('[StockAdjustmentRepository] Failed to post financial ledger entry:', err);
      }
    }

    // 2. Save the stock adjustment log to Supabase
    let savedAdjustment: InventoryStockAdjustment;
    try {
      savedAdjustment = await this.save(adjustment);
    } catch (err) {
      console.warn('[StockAdjustmentRepository] Failed to save adjustment audit:', err);
      savedAdjustment = adjustment;
    }

    // 3. Update the Adjustment Account balance
    if (adjustment.adjustmentAccountId || adjustment.adjustmentAccountCode) {
      const accId = adjustment.adjustmentAccountId || adjustment.adjustmentAccountCode;
      // Negative variance (loss) increases shrinkage/COGS balance
      const accountVariance = Math.abs(adjustment.valuationVarianceUSD);
      await adjustmentAccountRepository.updateBalance(accId, accountVariance);
    }

    return {
      adjustment: savedAdjustment,
      financialEntry: savedFinancialEntry
    };
  }
}

export const adjustmentAccountRepository = new AdjustmentAccountRepository();
export const stockAdjustmentRepository = new StockAdjustmentRepository();
