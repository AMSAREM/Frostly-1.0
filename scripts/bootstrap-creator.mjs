import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

/**
 * Out-of-band Platform Creator Bootstrapping Script
 * 
 * Usage:
 *   CREATOR_EMAIL="creator@yourdomain.com" CREATOR_PASSWORD="your-strong-password" node scripts/bootstrap-creator.mjs
 * 
 * Or rely on existing environment variables:
 *   SUPABASE_DB_URL or (VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
 *   VITE_DEV_CREATOR_EMAIL
 *   VITE_DEV_CREATOR_PASSWORD
 */

const creatorEmail = (process.env.CREATOR_EMAIL || process.env.VITE_DEV_CREATOR_EMAIL || '').trim().toLowerCase();
const creatorPassword = process.env.CREATOR_PASSWORD || process.env.VITE_DEV_CREATOR_PASSWORD;

if (!creatorEmail || !creatorPassword) {
  console.error('\n============================================================');
  console.error('FATAL: Missing creator credentials in environment variables.');
  console.error('Please provide:');
  console.error('  CREATOR_EMAIL (or VITE_DEV_CREATOR_EMAIL)');
  console.error('  CREATOR_PASSWORD (or VITE_DEV_CREATOR_PASSWORD)');
  console.error('Security Notice: Passwords must NEVER be hardcoded in files.');
  console.error('============================================================\n');
  process.exit(1);
}

if (creatorPassword.length < 8) {
  console.error('FATAL: Creator password must be at least 8 characters long.');
  process.exit(1);
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const connectionString = process.env.SUPABASE_DB_URL;

async function bootstrapViaSupabaseApi() {
  if (!supabaseUrl || !serviceRoleKey) return false;
  console.log('[Creator Bootstrap] Attempting bootstrap via HTTPS Supabase Service Role API...');
  
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Check if RPC bootstrap_platform_creator exists
  const { data: rpcData, error: rpcErr } = await adminClient.rpc('bootstrap_platform_creator', {
    p_email: creatorEmail,
    p_password: creatorPassword,
    p_notes: 'Platform Creator & Multi-Tenant Operator (Bootstrapped via Script)'
  });

  if (!rpcErr && rpcData) {
    console.log('[Creator Bootstrap] Successfully provisioned Creator via RPC:', rpcData);
    return true;
  }

  // Fallback: Use Supabase Admin Auth API directly
  console.log('[Creator Bootstrap] Provisioning creator via auth.admin API...');
  const { data: listData } = await adminClient.auth.admin.listUsers();
  const existingUser = listData?.users?.find(u => u.email?.toLowerCase() === creatorEmail);

  let userId = existingUser?.id;
  if (existingUser) {
    await adminClient.auth.admin.updateUserById(existingUser.id, {
      password: creatorPassword,
      email_confirm: true,
      user_metadata: { full_name: 'Platform Creator', platform_owner: true, role: 'platform_creator' },
      app_metadata: { role: 'platform_creator' }
    });
    console.log('[Creator Bootstrap] Existing auth user credentials updated.');
  } else {
    const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
      email: creatorEmail,
      password: creatorPassword,
      email_confirm: true,
      user_metadata: { full_name: 'Platform Creator', platform_owner: true, role: 'platform_creator' },
      app_metadata: { role: 'platform_creator' }
    });
    if (createErr) throw createErr;
    userId = newUser.user.id;
    console.log('[Creator Bootstrap] New auth user created:', userId);
  }

  // Ensure record in platform_admins
  if (userId) {
    const { error: adminErr } = await adminClient.from('platform_admins').upsert({
      user_id: userId,
      notes: 'Frostly Primary Platform Creator & Global Multi-Tenant Operator'
    });
    if (adminErr) {
      console.warn('[Creator Bootstrap] Note on platform_admins upsert:', adminErr.message);
    } else {
      console.log('[Creator Bootstrap] Recorded in platform_admins.');
    }
  }

  console.log('[Creator Bootstrap] Completed successfully via HTTPS API.');
  return true;
}

async function bootstrapViaPostgres() {
  if (!connectionString) {
    throw new Error('SUPABASE_DB_URL is not configured.');
  }
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });

  await client.connect();
  console.log('[Creator Bootstrap] Connected to direct Postgres database.');

  const res = await client.query(
    `SELECT public.bootstrap_platform_creator($1, $2, $3) AS result;`,
    [creatorEmail, creatorPassword, 'Platform Creator & Multi-Tenant Operator (Bootstrapped via Script)']
  );

  console.log('[Creator Bootstrap] Successfully provisioned Platform Creator via SQL:');
  console.log(JSON.stringify(res.rows[0]?.result, null, 2));
  await client.end();
  return true;
}

async function run() {
  try {
    const apiSuccess = await bootstrapViaSupabaseApi().catch((e) => {
      console.warn('[Creator Bootstrap] HTTPS API attempt error:', e.message);
      return false;
    });

    if (!apiSuccess) {
      await bootstrapViaPostgres();
    }
    console.log('\nAccount is active and stored securely at backend in auth.users & public.platform_admins.');
    process.exit(0);
  } catch (err) {
    console.error('[Creator Bootstrap] Failed:', err.message);
    process.exit(1);
  }
}

run();

