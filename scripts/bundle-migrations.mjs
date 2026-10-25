import fs from 'fs';
import path from 'path';

const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');

// 1. Upgrade Bundle (011 -> 025)
const upgradeFiles = [
  '011_multi_tenant.sql',
  '012_subscription_licensing.sql',
  '013_paystack_dual_billing.sql',
  '014_platform_admin_console.sql',
  '015_creator_bootstrap.sql',
  '016_revoke_delete_tenant.sql',
  '017_inventory_retail_linking.sql',
  '018_seed_landed_catch_species.sql',
  '019_platform_pricing_plans.sql',
  '020_user_login_and_feature_telemetry.sql',
  '021_realtime_user_sessions.sql',
  '022_inventory_adjustment_account.sql',
  '023_batch_image_storage.sql',
  '024_customer_ledger_payment_enhancements.sql',
  '025_supplier_ledger_payment_enhancements.sql',
  '026_amansocean_storefront.sql',
  '027_amansocean_official_pricelist.sql'
];

let upgradeContent = `-- ============================================================================
-- FROSTLY SEAFOOD COLD-CHAIN ERP
-- MULTI-TENANT & PLATFORM UPGRADE BUNDLE (Migrations 011 to 027)
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/xvlocfkkcnjopfzwobmg/sql
-- ============================================================================

`;

for (const file of upgradeFiles) {
  const p = path.join(migrationsDir, file);
  if (fs.existsSync(p)) {
    upgradeContent += `\n-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>\n`;
    upgradeContent += `-- START OF ${file}\n`;
    upgradeContent += `-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>\n\n`;
    upgradeContent += fs.readFileSync(p, 'utf-8');
    upgradeContent += `\n\n`;
  }
}

fs.writeFileSync(path.join(process.cwd(), 'supabase', 'RUN_MULTI_TENANT_UPGRADE.sql'), upgradeContent, 'utf-8');
console.log('✓ Created supabase/RUN_MULTI_TENANT_UPGRADE.sql');

// 2. Full System Bundle (001 -> 027)
const allFiles = [
  '001_extensions_and_types.sql',
  '002_tables.sql',
  '003_indexes.sql',
  '004_functions_and_triggers.sql',
  '005_rls_policies.sql',
  '006_grants.sql',
  '007_storage_policies.sql',
  '008_realtime.sql',
  '009_seed_data.sql',
  '011_multi_tenant.sql',
  '012_subscription_licensing.sql',
  '013_paystack_dual_billing.sql',
  '014_platform_admin_console.sql',
  '015_creator_bootstrap.sql',
  '016_revoke_delete_tenant.sql',
  '017_inventory_retail_linking.sql',
  '018_seed_landed_catch_species.sql',
  '019_platform_pricing_plans.sql',
  '020_user_login_and_feature_telemetry.sql',
  '021_realtime_user_sessions.sql',
  '022_inventory_adjustment_account.sql',
  '023_batch_image_storage.sql',
  '024_customer_ledger_payment_enhancements.sql',
  '025_supplier_ledger_payment_enhancements.sql',
  '026_amansocean_storefront.sql',
  '027_amansocean_official_pricelist.sql'
];

let fullContent = `-- ============================================================================
-- FROSTLY SEAFOOD COLD-CHAIN ERP
-- COMPLETE ALL-IN-ONE SYSTEM SCHEMA (Migrations 001 to 025)
-- Run this in Supabase SQL Editor for fresh database initialization
-- ============================================================================

`;

for (const file of allFiles) {
  const p = path.join(migrationsDir, file);
  if (fs.existsSync(p)) {
    fullContent += `\n-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>\n`;
    fullContent += `-- START OF ${file}\n`;
    fullContent += `-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>\n\n`;
    fullContent += fs.readFileSync(p, 'utf-8');
    fullContent += `\n\n`;
  }
}

fs.writeFileSync(path.join(process.cwd(), 'supabase', 'FULL_SCHEMA_ALL_MIGRATIONS.sql'), fullContent, 'utf-8');
console.log('✓ Created supabase/FULL_SCHEMA_ALL_MIGRATIONS.sql');
