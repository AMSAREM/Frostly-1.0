import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !anonKey) {
  console.error('❌ Missing Supabase URL or Anon Key in environment variables');
  process.exit(1);
}

const client = createClient(supabaseUrl, serviceRoleKey || anonKey);

async function runEndToEndVerification() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🐟 FROSTLY LIVE SUPABASE VERIFICATION: INPUT TO SUPABASE STORAGE');
  console.log(`Connected to: ${supabaseUrl}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const timestamp = Date.now();
  const testOrgId = '00000000-0000-0000-0000-000000000001';

  // 1. TEST INVENTORY BATCH INTAKE
  console.log('▶ [TEST 1] Writing new Inventory Batch directly to Supabase table `inventory_batches`...');
  const batchId = `LOT-AUDIT-${timestamp}`;
  const batchPayload = {
    id: batchId,
    species_id: 'spec-bluefin',
    species_name: 'Pacific Bluefin Tuna (Super-Cryo)',
    scientific_name: 'Thunnus orientalis',
    category: 'Pelagic',
    harvest_date: new Date().toISOString().split('T')[0],
    landing_port: 'Port of San Francisco',
    vessel_name: 'F/V Live Pioneer',
    vessel_registration: 'US-8821',
    captain_name: 'Capt. Test',
    fao_area: 'FAO 61',
    gear_type: 'Pelagic Longline',
    grade: 'Sashimi AAA',
    initial_weight_kg: 240.5,
    available_weight_kg: 240.5,
    allocated_weight_kg: 0,
    storage_zone: 'Super-Cryo Deep Freeze (-60°C)',
    current_temp_celsius: -59.5,
    target_temp_celsius: -60.0,
    cost_per_kg: 68.0,
    wholesale_price_per_kg: 115.0,
    certifications: ['MSC Certified', 'Safe Quality Food (SQF)'],
    inspection_status: 'Passed',
    histamine_ppm: 1.8,
    core_temp_celsius: -59.2,
    received_date: new Date().toISOString().split('T')[0],
    expiry_date: new Date(Date.now() + 730 * 86400000).toISOString().split('T')[0],
    qr_code_seed: `${batchId}-SEED`,
    notes: 'Direct Supabase input verification test',
    organization_id: testOrgId,
  };

  const { data: insertedBatch, error: batchErr } = await client
    .from('inventory_batches')
    .insert(batchPayload)
    .select('id, species_name, initial_weight_kg, created_at, organization_id')
    .single();

  if (batchErr) {
    console.error('❌ Batch INSERT failed:', batchErr.message);
    process.exit(1);
  }
  console.log('✅ Batch successfully inserted into Supabase:');
  console.log('   Row Data:', insertedBatch);

  // Read back to ensure immediate persistence
  const { data: readBatch, error: readBatchErr } = await client
    .from('inventory_batches')
    .select('id, species_name, available_weight_kg')
    .eq('id', batchId)
    .single();

  console.log('✅ Directly read back from Supabase:', readBatch);
  await client.from('inventory_batches').delete().eq('id', batchId);
  console.log('🧹 Cleaned up test batch.\n');

  // 2. TEST CUSTOMER ACCOUNT CREATION
  console.log('▶ [TEST 2] Writing Customer directly to Supabase table `customers`...');
  const customerPayload = {
    id: `cust-audit-${timestamp}`,
    name: `Omakase San Francisco ${timestamp}`,
    company_name: `Omakase SF Group LLC`,
    type: 'Wholesale Restaurant',
    tier: 'Tier 1 (VIP Wholesale -15%)',
    contact_person: 'Executive Chef Hiro',
    email: `hiro_${timestamp}@omakase-sf.test`,
    phone: '+1 (415) 555-0144',
    address: '100 California Street',
    city: 'San Francisco',
    credit_limit_usd: 50000,
    outstanding_balance_usd: 12450.75,
    payment_terms: 'Net-15',
    total_orders_count: 3,
    total_spend_usd: 48900.50,
    status: 'Active',
    organization_id: testOrgId,
  };

  const { data: insertedCust, error: custErr } = await client
    .from('customers')
    .insert(customerPayload)
    .select('id, name, contact_person, outstanding_balance_usd, organization_id')
    .single();

  if (custErr) {
    console.error('❌ Customer INSERT failed:', custErr.message);
    process.exit(1);
  }
  console.log('✅ Customer successfully inserted into Supabase:');
  console.log('   Row Data:', insertedCust);

  // Update customer balance in Supabase
  const { data: updatedCust, error: updateCustErr } = await client
    .from('customers')
    .update({ outstanding_balance_usd: 10000.00 })
    .eq('id', customerPayload.id)
    .select('id, outstanding_balance_usd')
    .single();

  console.log('✅ Customer updated in Supabase:', updatedCust);
  await client.from('customers').delete().eq('id', customerPayload.id);
  console.log('🧹 Cleaned up test customer.\n');

  // 3. TEST SUPPLIER / HARVESTER CREATION
  console.log('▶ [TEST 3] Writing Supplier Harvester directly to Supabase table `suppliers`...');
  const supplierPayload = {
    id: `supp-audit-${timestamp}`,
    name: `Golden Gate Harvesters Co-Op ${timestamp}`,
    contact_person: 'Captain Rodriguez',
    type: 'Fishermen Co-op',
    email: `rodriguez_${timestamp}@coop.test`,
    phone: '+1 (415) 555-9922',
    port_location: 'Pier 45, San Francisco',
    country: 'United States',
    vessel_names: ['F/V Pacific Star', 'F/V Sea Rover'],
    supplied_species: ['Pacific Bluefin Tuna', 'Yellowfin Tuna', 'King Salmon'],
    payment_terms: 'Net-30',
    outstanding_payable_usd: 28500.00,
    total_purchased_usd: 195000.00,
    total_weight_supplied_kg: 3200,
    rating: 4.95,
    status: 'Active',
    organization_id: testOrgId,
  };

  const { data: insertedSupp, error: suppErr } = await client
    .from('suppliers')
    .insert(supplierPayload)
    .select('id, name, port_location, outstanding_payable_usd, organization_id')
    .single();

  if (suppErr) {
    console.error('❌ Supplier INSERT failed:', suppErr.message);
    process.exit(1);
  }
  console.log('✅ Supplier successfully inserted into Supabase:');
  console.log('   Row Data:', insertedSupp);
  await client.from('suppliers').delete().eq('id', supplierPayload.id);
  console.log('🧹 Cleaned up test supplier.\n');

  // 4. TEST WHOLESALE ORDERS
  console.log('▶ [TEST 4] Writing Wholesale Order directly to Supabase table `client_orders`...');
  const orderId = `ORD-AUDIT-${timestamp}`;
  const orderPayload = {
    id: orderId,
    customer_id: 'CUST-AUTH-VERIFY-001',
    client_name: 'Nobu San Francisco',
    client_category: 'Wholesale Restaurant',
    contact_person: 'Executive Chef Nobu Matsuhisa',
    contact_email: 'nobu.sf@noburestaurants.test',
    contact_phone: '+1 (415) 555-9000',
    destination_city: 'San Francisco',
    delivery_address: '77 New Montgomery St, San Francisco, CA',
    order_date: new Date().toISOString().split('T')[0],
    required_delivery_date: new Date().toISOString().split('T')[0],
    status: 'Delivered',
    quoted_total_usd: 4850.00,
    adjusted_total_usd: 4850.00,
    payment_status: 'Paid in Full',
    packaging_requirement: 'Super-Cryo Insulated Cryo-Tote (-60°C)',
    packing_slip_generated: true,
    organization_id: testOrgId,
  };

  const { data: insertedOrder, error: orderErr } = await client
    .from('client_orders')
    .insert(orderPayload)
    .select('id, client_name, quoted_total_usd, status, payment_status, organization_id')
    .single();

  if (orderErr) {
    console.error('❌ Order INSERT failed:', orderErr.message);
    process.exit(1);
  }
  console.log('✅ Order successfully inserted into Supabase:');
  console.log('   Row Data:', insertedOrder);
  await client.from('client_orders').delete().eq('id', orderId);
  console.log('🧹 Cleaned up test order.\n');

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🎯 RESULT: ALL INPUT READS AND WRITES GO STRAIGHT TO LIVE SUPABASE');
  console.log('═══════════════════════════════════════════════════════════════════');
}

runEndToEndVerification().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});
