import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const targetOrgInput = process.argv[2] || 'Amans ocean';

console.log('═══════════════════════════════════════════════════════════════════');
console.log('🐟 FROSTLY WORKSPACE PURGE TOOL');
console.log(`Target Organization: "${targetOrgInput}"`);
console.log('Requirement: PURGE ALL OPERATIONAL DATA EXCEPT USER CREDENTIALS');
console.log('═══════════════════════════════════════════════════════════════════\n');

const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

async function runDirectPostgres() {
  console.log('▶ Connecting directly via PostgreSQL wire protocol...');
  const client = new pg.Client({
    connectionString,
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  try {
    // 1. Find organization
    const orgRes = await client.query(`
      SELECT * FROM public.organizations 
      WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))
         OR LOWER(TRIM(name)) LIKE '%' || LOWER(TRIM($1)) || '%'
         OR id::text = $1
      ORDER BY CASE WHEN LOWER(TRIM(name)) = LOWER(TRIM($1)) THEN 1 ELSE 2 END
      LIMIT 1;
    `, [targetOrgInput]);

    if (orgRes.rows.length === 0) {
      console.error(`❌ Organization "${targetOrgInput}" not found in database.`);
      const allOrgs = await client.query('SELECT id, name FROM public.organizations LIMIT 10;');
      console.log('Available organizations:');
      allOrgs.rows.forEach(o => console.log(`  - [${o.id}] ${o.name}`));
      process.exit(1);
    }

    const org = orgRes.rows[0];
    console.log(`✓ Located Organization: "${org.name}" (${org.id})`);

    // 2. Fetch staff profiles to confirm preservation
    const staffRes = await client.query(`
      SELECT id, email, full_name, role 
      FROM public.staff_profiles 
      WHERE organization_id = $1;
    `, [org.id]);

    console.log(`\n🔒 User Credentials to PRESERVE (${staffRes.rows.length} accounts):`);
    staffRes.rows.forEach((s, idx) => {
      console.log(`  [${idx + 1}] ${s.full_name} (${s.email}) - Role: ${s.role}`);
    });

    // 3. Purge operational tables
    console.log('\n🗑️ Purging operational & transactional records...');
    const tables = [
      'inventory_adjustments',
      'inventory_adjustment_accounts',
      'order_line_items',
      'client_orders',
      'purchase_order_items',
      'purchase_order_landings',
      'retail_sale_items',
      'retail_transactions',
      'retail_wholesale_products',
      'haccp_audit_records',
      'financial_ledger_entries',
      'reefer_sensor_readings',
      'inventory_batches',
      'reefer_vehicles',
      'fleet_vessels',
      'system_notifications',
      'user_feature_usage_logs',
      'market_price_index',
      'customers',
      'suppliers',
      'species',
      'app_settings'
    ];

    for (const table of tables) {
      const checkTable = await client.query(`
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1;
      `, [table]);

      if (checkTable.rows.length > 0) {
        const delRes = await client.query(`DELETE FROM public.${table} WHERE organization_id = $1;`, [org.id]);
        console.log(`  - ${table}: ${delRes.rowCount} records deleted`);
      }
    }

    // Reinsert default app settings
    await client.query(`
      INSERT INTO public.app_settings (
        id, organization_id, company_name, facility_code, currency,
        tax_rate, super_cryo_target_c, cold_storage_target_c,
        slush_ice_target_c, live_tank_target_c
      ) VALUES (
        1, $1, $2, $3, COALESCE($4, 'USD'), 0.00, -60.0, -22.0, 1.0, 8.0
      ) ON CONFLICT DO NOTHING;
    `, [org.id, org.name, 'FAC-' + org.name.slice(0, 4).toUpperCase(), org.billing_currency]);

    console.log('\n============================================================');
    console.log(`✅ SUCCESS: All operational data purged from "${org.name}".`);
    console.log(`All ${staffRes.rows.length} user credentials, accounts, and passwords remain intact.`);
    console.log('============================================================');
  } finally {
    await client.end();
  }
}

async function runViaSupabaseClient() {
  console.log(`▶ Connecting via Supabase Admin Client to ${supabaseUrl}...`);
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Call RPC purge_tenant_data_except_users
  const { data, error } = await supabase.rpc('purge_tenant_data_except_users', {
    p_org_identifier: targetOrgInput
  });

  if (error) {
    console.warn(`RPC error: ${error.message}. Attempting direct table deletes...`);
    // Fallback: direct table queries via admin client
    const { data: orgs } = await supabase
      .from('organizations')
      .select('*')
      .ilike('name', `%${targetOrgInput}%`)
      .limit(1);

    if (!orgs || orgs.length === 0) {
      console.error(`❌ Could not locate organization "${targetOrgInput}"`);
      process.exit(1);
    }

    const org = orgs[0];
    console.log(`✓ Located Organization: "${org.name}" (${org.id})`);

    const { data: staff } = await supabase
      .from('staff_profiles')
      .select('id, email, full_name, role')
      .eq('organization_id', org.id);

    console.log(`\n🔒 PRESERVING ${staff?.length || 0} user credentials:`);
    staff?.forEach(s => console.log(`  - ${s.full_name} (${s.email})`));

    const tables = [
      'inventory_adjustments',
      'order_line_items',
      'client_orders',
      'purchase_order_items',
      'purchase_order_landings',
      'retail_sale_items',
      'retail_transactions',
      'retail_wholesale_products',
      'haccp_audit_records',
      'financial_ledger_entries',
      'reefer_sensor_readings',
      'inventory_batches',
      'reefer_vehicles',
      'fleet_vessels',
      'system_notifications',
      'customers',
      'suppliers'
    ];

    for (const t of tables) {
      try {
        const { error: dErr } = await supabase.from(t).delete().eq('organization_id', org.id);
        if (dErr) {
          console.warn(`  - ${t}: ${dErr.message}`);
        } else {
          console.log(`  - ${t}: purged`);
        }
      } catch (e) {
        // ignore missing tables
      }
    }

    console.log(`\n✅ Finished purging data from "${org.name}". User credentials preserved.`);
    return;
  }

  console.log('\n✅ RPC EXECUTION RESULT:');
  console.log(JSON.stringify(data, null, 2));
}

async function main() {
  if (connectionString && !connectionString.startsWith('http')) {
    await runDirectPostgres();
  } else if (supabaseUrl && serviceKey) {
    await runViaSupabaseClient();
  } else {
    console.log('NOTE: SUPABASE_DB_URL or SUPABASE_SERVICE_ROLE_KEY environment variables not set in container.');
    console.log('You can run the one-click SQL script directly in your Supabase SQL Editor:');
    console.log('File: supabase/REMOVE_DATA_AMANS_OCEAN.sql\n');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
