import pg from 'pg';
import fs from 'fs';
import path from 'path';

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error('\n============================================================');
  console.error('FATAL: Missing SUPABASE_DB_URL environment variable.');
  console.error('Migration aborted. Pass SUPABASE_DB_URL to connect to Postgres.');
  console.error('Security Notice: Database passwords must never be committed.');
  console.error('============================================================\n');
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

const migrationFiles = [
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
  '015_creator_bootstrap.sql'
];

async function runMigrations() {
  try {
    await client.connect();
    console.log('Connected to Supabase DB: xvlocfkkcnjopfzwobmg');

    for (const filename of migrationFiles) {
      const filePath = path.join(process.cwd(), 'supabase', 'migrations', filename);
      console.log(`\n--------------------------------------------------`);
      console.log(`Executing migration: ${filename}`);
      console.log(`--------------------------------------------------`);
      
      const sql = fs.readFileSync(filePath, 'utf-8');
      try {
        await client.query(sql);
        console.log(`✓ Successfully applied ${filename}`);
      } catch (err) {
        console.error(`✗ Error applying ${filename}:`, err.message);
        throw err;
      }
    }

    console.log('\n==================================================');
    console.log('All migrations applied successfully!');
    console.log('Running validation queries...');
    console.log('==================================================');

    const validationPath = path.join(process.cwd(), 'supabase', 'migrations', '010_validation.sql');
    const validationSql = fs.readFileSync(validationPath, 'utf-8');
    await client.query(validationSql);
    console.log('✓ Validation suite passed with zero errors!');

    // Let's print final summary of created tables
    const tableRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log('\nPublic Tables in Database:');
    tableRes.rows.forEach(r => console.log(` - ${r.table_name}`));

    // Count policies per table
    const policyRes = await client.query(`
      SELECT tablename, COUNT(*) as policy_count
      FROM pg_policies
      WHERE schemaname = 'public'
      GROUP BY tablename
      ORDER BY tablename;
    `);
    console.log('\nRLS Policy Counts per Table:');
    policyRes.rows.forEach(r => console.log(` - ${r.tablename}: ${r.policy_count} policies`));

    // Verify insert-only tables have 0 UPDATE / DELETE policies
    const forbiddenPolicies = await client.query(`
      SELECT tablename, cmd 
      FROM pg_policies 
      WHERE schemaname = 'public' 
        AND tablename IN ('financial_ledger_entries', 'haccp_audit_records', 'reefer_sensor_readings')
        AND cmd IN ('UPDATE', 'DELETE');
    `);
    if (forbiddenPolicies.rows.length === 0) {
      console.log('\n✓ Verified: Exactly ZERO UPDATE/DELETE policies on insert-only compliance tables!');
    } else {
      console.error('\n✗ WARNING: Found forbidden policies on insert-only tables:', forbiddenPolicies.rows);
    }

  } catch (err) {
    console.error('\nMigration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
