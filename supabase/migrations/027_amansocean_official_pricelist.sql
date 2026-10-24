-- =============================================================================
-- Migration 027: Official Amans Ocean Price List (32 GH₵ SKUs)
-- Deactivates legacy USD demo products and upserts the official Amans Ocean
-- Ghana Cedi (GH₵) catalog into species, retail_wholesale_products, and
-- inventory_batches for the primary storefront organization.
-- =============================================================================

DO $$
DECLARE
  v_org_id UUID;
BEGIN
  -- 0. Ensure optional batch linkage & cold-zone columns exist on retail_wholesale_products
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'retail_wholesale_products'
      AND column_name = 'linked_batch_id'
  ) THEN
    ALTER TABLE public.retail_wholesale_products ADD COLUMN linked_batch_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'retail_wholesale_products'
      AND column_name = 'storage_zone'
  ) THEN
    ALTER TABLE public.retail_wholesale_products ADD COLUMN storage_zone TEXT;
  END IF;

  -- 1. Resolve primary Amans Ocean organization
  SELECT id INTO v_org_id
  FROM public.organizations
  WHERE id = '35a94c6e-e230-4b7c-8404-a4f0ae06b798'::uuid
  LIMIT 1;

  IF v_org_id IS NULL THEN
    SELECT id INTO v_org_id
    FROM public.organizations
    WHERE name ILIKE '%amans%ocean%'
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF v_org_id IS NULL THEN
    SELECT id INTO v_org_id
    FROM public.organizations
    WHERE id <> '00000000-0000-0000-0000-000000000001'::uuid
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF v_org_id IS NULL THEN
    RAISE NOTICE 'No storefront organization found; skipping Migration 027 seed.';
    RETURN;
  END IF;

  -- 2. Soft-deactivate legacy USD demo products
  UPDATE public.retail_wholesale_products
  SET is_active = FALSE,
      is_available_for_retail = FALSE,
      is_available_for_wholesale = FALSE,
      updated_at = NOW()
  WHERE organization_id = v_org_id
    AND id IN (
      'prod-prawns-500g',
      'prod-fish-fingers-750g',
      'prod-fries-1kg',
      'prod-salmon-fillet-600g',
      'prod-calamari-rings-500g',
      'prod-onion-rings-750g',
      'prod-mango-sorbet-500ml',
      'prod-gelato-sea-salt-500ml'
    );

  -- 3. Upsert Amans Ocean species catalog
  INSERT INTO public.species (
    organization_id, id, name, scientific_name, category, default_zone,
    standard_price_per_kg, available_grades, fao_zones, gear_types,
    seasonal_peak, image, shelf_life_fresh_days, shelf_life_frozen_months, is_active
  )
  VALUES
    (v_org_id, 'sp-ao-red-fish', 'Atlantic Red Fish', 'Sebastes marinus', 'Pelagic', 'Commercial Cold Storage (-22°C)', 80, ARRAY['Grade #1'], ARRAY['FAO 34'], ARRAY['Coastal Line & Trawl'], 'Year-Round Cold Chain', '', 5, 18, TRUE),
    (v_org_id, 'sp-ao-red-snapper', 'Wild Red Snapper', 'Lutjanus campechanus', 'Groundfish', 'Commercial Cold Storage (-22°C)', 90, ARRAY['Grade #1'], ARRAY['FAO 34'], ARRAY['Hook & Line'], 'Year-Round Cold Chain', '', 5, 18, TRUE),
    (v_org_id, 'sp-ao-nile-perch', 'Nile Perch', 'Lates niloticus', 'Groundfish', 'Commercial Cold Storage (-22°C)', 85, ARRAY['Grade #1'], ARRAY['FAO 01'], ARRAY['Freshwater Catch'], 'Year-Round Cold Chain', '', 5, 18, TRUE),
    (v_org_id, 'sp-ao-sea-breams', 'Sea Bream', 'Sparus aurata', 'Pelagic', 'Commercial Cold Storage (-22°C)', 80, ARRAY['Grade #1'], ARRAY['FAO 34'], ARRAY['Coastal Line'], 'Year-Round Cold Chain', '', 5, 18, TRUE),
    (v_org_id, 'sp-ao-barracuda', 'Great Barracuda', 'Sphyraena barracuda', 'Pelagic', 'Commercial Cold Storage (-22°C)', 80, ARRAY['Grade #1'], ARRAY['FAO 34'], ARRAY['Troll Line'], 'Year-Round Cold Chain', '', 5, 18, TRUE),
    (v_org_id, 'sp-ao-sole-fish', 'West African Sole', 'Solea solea', 'Groundfish', 'Commercial Cold Storage (-22°C)', 80, ARRAY['Grade #1'], ARRAY['FAO 34'], ARRAY['Bottom Net'], 'Year-Round Cold Chain', '', 5, 18, TRUE),
    (v_org_id, 'sp-ao-grouper', 'Atlantic Grouper', 'Epinephelus marginatus', 'Groundfish', 'Commercial Cold Storage (-22°C)', 150, ARRAY['Sashimi AAA', 'Grade #1'], ARRAY['FAO 34'], ARRAY['Reef Line'], 'Year-Round Cold Chain', '', 5, 18, TRUE),
    (v_org_id, 'sp-ao-butter-nose', 'Butter Nose Fish', 'Galeoides decadactylus', 'Pelagic', 'Commercial Cold Storage (-22°C)', 65, ARRAY['Grade #1'], ARRAY['FAO 34'], ARRAY['Coastal Net'], 'Year-Round Cold Chain', '', 5, 18, TRUE),
    (v_org_id, 'sp-ao-butter-fish', 'Atlantic Butterfish', 'Peprilus triacanthus', 'Pelagic', 'Commercial Cold Storage (-22°C)', 60, ARRAY['Grade #1'], ARRAY['FAO 34'], ARRAY['Coastal Net'], 'Year-Round Cold Chain', '', 5, 18, TRUE),
    (v_org_id, 'sp-ao-zipper-fish', 'Zipper Scabbardfish', 'Trichiurus lepturus', 'Pelagic', 'Commercial Cold Storage (-22°C)', 60, ARRAY['Grade #1'], ARRAY['FAO 34'], ARRAY['Coastal Line'], 'Year-Round Cold Chain', '', 5, 18, TRUE),
    (v_org_id, 'sp-ao-cassava-fish', 'Cassava Croaker', 'Pseudotolithus senegalensis', 'Groundfish', 'Commercial Cold Storage (-22°C)', 100, ARRAY['Sashimi AAA', 'Grade #1'], ARRAY['FAO 34'], ARRAY['Coastal Line'], 'Year-Round Cold Chain', '', 5, 18, TRUE),
    (v_org_id, 'sp-ao-tilapia', 'Volta Tilapia', 'Oreochromis niloticus', 'Groundfish', 'Commercial Cold Storage (-22°C)', 80, ARRAY['Grade #1'], ARRAY['FAO 01'], ARRAY['Volta Cage & Net'], 'Year-Round Cold Chain', '', 5, 18, TRUE),
    (v_org_id, 'sp-ao-shrimps', 'Atlantic Pink Shrimp', 'Penaeus notialis', 'Crustacean', 'Commercial Cold Storage (-22°C)', 100, ARRAY['Sashimi AAA', 'Grade #1'], ARRAY['FAO 34'], ARRAY['Shrimp Trap'], 'Year-Round Cold Chain', '', 5, 18, TRUE),
    (v_org_id, 'sp-ao-prawns', 'Jumbo Tiger Prawn', 'Penaeus monodon', 'Crustacean', 'Commercial Cold Storage (-22°C)', 250, ARRAY['Sashimi AAA', 'Grade #1'], ARRAY['FAO 34'], ARRAY['Deepwater Trap'], 'Year-Round Cold Chain', '', 5, 18, TRUE),
    (v_org_id, 'sp-ao-octopus', 'Common Atlantic Octopus', 'Octopus vulgaris', 'Mollusk', 'Commercial Cold Storage (-22°C)', 150, ARRAY['Grade #1'], ARRAY['FAO 34'], ARRAY['Clay Pot & Trap'], 'Year-Round Cold Chain', '', 5, 18, TRUE),
    (v_org_id, 'sp-ao-squid', 'Atlantic Calamari Squid', 'Loligo vulgaris', 'Mollusk', 'Commercial Cold Storage (-22°C)', 150, ARRAY['Grade #1'], ARRAY['FAO 34'], ARRAY['Jig Line'], 'Year-Round Cold Chain', '', 5, 18, TRUE),
    (v_org_id, 'sp-ao-sea-snails', 'West African Sea Snail', 'Cymbium pepo', 'Mollusk', 'Commercial Cold Storage (-22°C)', 40, ARRAY['Grade #1'], ARRAY['FAO 34'], ARRAY['Coastal Dive'], 'Year-Round Cold Chain', '', 5, 18, TRUE),
    (v_org_id, 'sp-ao-sea-crabs', 'Blue Swimming Sea Crab', 'Callinectes amnicola', 'Crustacean', 'Commercial Cold Storage (-22°C)', 30, ARRAY['Grade #1'], ARRAY['FAO 34'], ARRAY['Crab Pot'], 'Year-Round Cold Chain', '', 5, 18, TRUE),
    (v_org_id, 'sp-ao-lobsters', 'Spiny Rock Lobster', 'Panulirus regius', 'Crustacean', 'Commercial Cold Storage (-22°C)', 180, ARRAY['Sashimi AAA'], ARRAY['FAO 34'], ARRAY['Lobster Creel'], 'Year-Round Cold Chain', '', 5, 18, TRUE),
    (v_org_id, 'sp-ao-mixed-fillet', 'Ocean Whitefish Fillet', 'Lutjanidae spp.', 'Groundfish', 'Commercial Cold Storage (-22°C)', 150, ARRAY['Grade #1'], ARRAY['FAO 34'], ARRAY['Hook & Line'], 'Year-Round Cold Chain', '', 5, 18, TRUE),
    (v_org_id, 'sp-ao-doctor-fish', 'Atlantic Surgeonfish (Doctor Fish)', 'Acanthurus monroviae', 'Pelagic', 'Commercial Cold Storage (-22°C)', 100, ARRAY['Grade #1'], ARRAY['FAO 34'], ARRAY['Reef Net'], 'Year-Round Cold Chain', '', 5, 18, TRUE),
    (v_org_id, 'sp-ao-fish-powder', 'Pure Dried Fish Powder', 'Clupeidae spp.', 'Pelagic', 'Commercial Cold Storage (-22°C)', 50, ARRAY['Grade #1'], ARRAY['FAO 34'], ARRAY['Hygienic Mill'], 'Year-Round Cold Chain', '', 90, 24, TRUE),
    (v_org_id, 'sp-ao-shrimp-powder', 'Pure Dried Shrimp Powder', 'Penaeus notialis', 'Crustacean', 'Commercial Cold Storage (-22°C)', 50, ARRAY['Grade #1'], ARRAY['FAO 34'], ARRAY['Hygienic Mill'], 'Year-Round Cold Chain', '', 90, 24, TRUE)
  ON CONFLICT (organization_id, id) DO UPDATE SET
    name = EXCLUDED.name,
    scientific_name = EXCLUDED.scientific_name,
    category = EXCLUDED.category,
    standard_price_per_kg = EXCLUDED.standard_price_per_kg;

  -- 4. Upsert the 32 Official Amans Ocean GH₵ SKUs
  INSERT INTO public.retail_wholesale_products (
    organization_id, id, sku, name, species_id, category, cut_type, grade, unit,
    stock_kg, cost_price_per_unit, wholesale_price_per_unit, retail_price_per_unit,
    wholesale_min_qty, retail_pack_size, image_url, origin,
    is_available_for_retail, is_available_for_wholesale, is_active
  )
  VALUES
    (v_org_id, 'ao-red-fish', 'AO-REDFISH-1KG', 'Red Fish', 'sp-ao-red-fish', 'Pelagic', 'Whole Round Fish', 'Grade #1', 'kg', 180, 57.60, 80, 80, 5, '1kg', '', 'Amans Ocean Coldstore · Abrepo, Barekese Rd', TRUE, TRUE, TRUE),
    (v_org_id, 'ao-red-snapper', 'AO-SNAPPER-1KG', 'Red Snapper', 'sp-ao-red-snapper', 'Groundfish', 'Whole Round Fish', 'Grade #1', 'kg', 165, 64.80, 90, 90, 5, '1kg', '', 'Amans Ocean Coldstore · Abrepo, Barekese Rd', TRUE, TRUE, TRUE),
    (v_org_id, 'ao-nile-perch', 'AO-NILEPERCH-1KG', 'Nile Perch', 'sp-ao-nile-perch', 'Groundfish', 'Whole Round Fish', 'Grade #1', 'kg', 140, 61.20, 85, 85, 5, '1kg', '', 'Amans Ocean Coldstore · Abrepo, Barekese Rd', TRUE, TRUE, TRUE),
    (v_org_id, 'ao-sea-breams', 'AO-SEABREAM-1KG', 'Sea Breams', 'sp-ao-sea-breams', 'Pelagic', 'Whole Round Fish', 'Grade #1', 'kg', 150, 57.60, 80, 80, 5, '1kg', '', 'Amans Ocean Coldstore · Abrepo, Barekese Rd', TRUE, TRUE, TRUE),
    (v_org_id, 'ao-barracuda', 'AO-BARRACUDA-1KG', 'Barracuda', 'sp-ao-barracuda', 'Pelagic', 'Whole Round Fish', 'Grade #1', 'kg', 135, 57.60, 80, 80, 5, '1kg', '', 'Amans Ocean Coldstore · Abrepo, Barekese Rd', TRUE, TRUE, TRUE),
    (v_org_id, 'ao-sole-fish', 'AO-SOLEFISH-1KG', 'Sole Fish', 'sp-ao-sole-fish', 'Groundfish', 'Whole Round Fish', 'Grade #1', 'kg', 120, 57.60, 80, 80, 5, '1kg', '', 'Amans Ocean Coldstore · Abrepo, Barekese Rd', TRUE, TRUE, TRUE),
    (v_org_id, 'ao-grouper', 'AO-GROUPER-1KG', 'Grouper', 'sp-ao-grouper', 'Groundfish', 'Whole Round Fish', 'Sashimi AAA', 'kg', 110, 108.00, 150, 150, 5, '1kg', '', 'Amans Ocean Coldstore · Abrepo, Barekese Rd', TRUE, TRUE, TRUE),
    (v_org_id, 'ao-butter-nose', 'AO-BUTTERNOSE-1KG', 'Butter Nose', 'sp-ao-butter-nose', 'Pelagic', 'Whole Round Fish', 'Grade #1', 'kg', 175, 46.80, 65, 65, 5, '1kg', '', 'Amans Ocean Coldstore · Abrepo, Barekese Rd', TRUE, TRUE, TRUE),
    (v_org_id, 'ao-butter-fish', 'AO-BUTTERFISH-1KG', 'Butter Fish', 'sp-ao-butter-fish', 'Pelagic', 'Whole Round Fish', 'Grade #1', 'kg', 190, 43.20, 60, 60, 5, '1kg', '', 'Amans Ocean Coldstore · Abrepo, Barekese Rd', TRUE, TRUE, TRUE),
    (v_org_id, 'ao-butter-fish-fillet', 'AO-BTRFILLET-1KG', 'Butter Fish Fillet', 'sp-ao-butter-fish', 'Pelagic', 'Skin-On Loin / Fillet', 'Grade #1', 'kg', 95, 108.00, 150, 150, 5, '1kg', '', 'Amans Ocean Coldstore · Abrepo, Barekese Rd', TRUE, TRUE, TRUE),
    (v_org_id, 'ao-zipper-fish', 'AO-ZIPPER-1KG', 'Zipper Fish', 'sp-ao-zipper-fish', 'Pelagic', 'Whole Round Fish', 'Grade #1', 'kg', 160, 43.20, 60, 60, 5, '1kg', '', 'Amans Ocean Coldstore · Abrepo, Barekese Rd', TRUE, TRUE, TRUE),
    (v_org_id, 'ao-cassava-fish', 'AO-CASSAVA-1KG', 'Cassava Fish', 'sp-ao-cassava-fish', 'Groundfish', 'Whole Round Fish', 'Grade #1', 'kg', 155, 72.00, 100, 100, 5, '1kg', '', 'Amans Ocean Coldstore · Abrepo, Barekese Rd', TRUE, TRUE, TRUE),
    (v_org_id, 'ao-cassava-fish-fillet', 'AO-CASFILLET-1KG', 'Cassava Fish Fillet', 'sp-ao-cassava-fish', 'Groundfish', 'Skin-On Loin / Fillet', 'Sashimi AAA', 'kg', 90, 129.60, 180, 180, 5, '1kg', '', 'Amans Ocean Coldstore · Abrepo, Barekese Rd', TRUE, TRUE, TRUE),
    (v_org_id, 'ao-cassava-chunks', 'AO-CASCHUNKS-1KG', 'Cassava Chunks (No Head)', 'sp-ao-cassava-fish', 'Groundfish', 'Headless & Gutted (H&G)', 'Grade #1', 'kg', 105, 129.60, 180, 180, 5, '1kg', '', 'Amans Ocean Coldstore · Abrepo, Barekese Rd', TRUE, TRUE, TRUE),
    (v_org_id, 'ao-tilapia', 'AO-TILAPIA-1KG', 'Tilapia', 'sp-ao-tilapia', 'Groundfish', 'Whole Round Fish', 'Grade #1', 'kg', 210, 57.60, 80, 80, 5, '1kg', '', 'Amans Ocean Coldstore · Abrepo, Barekese Rd', TRUE, TRUE, TRUE),
    (v_org_id, 'ao-unpeeled-shrimps', 'AO-UNPLSHRMP-1KG', 'Unpeeled Shrimps', 'sp-ao-shrimps', 'Crustacean', 'IQF Flash Frozen Box', 'Grade #1', 'kg', 130, 72.00, 100, 100, 5, '1kg', '', 'Amans Ocean Coldstore · Abrepo, Barekese Rd', TRUE, TRUE, TRUE),
    (v_org_id, 'ao-peeled-shrimps', 'AO-PLDSHRMP-1KG', 'Peeled Shrimps', 'sp-ao-shrimps', 'Crustacean', 'IQF Flash Frozen Box', 'Sashimi AAA', 'kg', 115, 144.00, 200, 220, 10, '1kg', '', 'Amans Ocean Coldstore · Abrepo, Barekese Rd', TRUE, TRUE, TRUE),
    (v_org_id, 'ao-prawns-jumbo', 'AO-PRAWNJMB-1KG', 'Prawns (Jumbo)', 'sp-ao-prawns', 'Crustacean', 'IQF Flash Frozen Box', 'Sashimi AAA', 'kg', 85, 180.00, 250, 250, 5, '1kg', '', 'Amans Ocean Coldstore · Abrepo, Barekese Rd', TRUE, TRUE, TRUE),
    (v_org_id, 'ao-prawns-medium', 'AO-PRAWNMED-1KG', 'Prawns (Medium)', 'sp-ao-prawns', 'Crustacean', 'IQF Flash Frozen Box', 'Grade #1', 'kg', 100, 158.40, 220, 220, 5, '1kg', '', 'Amans Ocean Coldstore · Abrepo, Barekese Rd', TRUE, TRUE, TRUE),
    (v_org_id, 'ao-octopus', 'AO-OCTOPUS-1KG', 'Octopus', 'sp-ao-octopus', 'Mollusk', 'IQF Flash Frozen Box', 'Grade #1', 'kg', 75, 108.00, 150, 150, 5, '1kg', '', 'Amans Ocean Coldstore · Abrepo, Barekese Rd', TRUE, TRUE, TRUE),
    (v_org_id, 'ao-squid', 'AO-SQUID-1KG', 'Squid', 'sp-ao-squid', 'Mollusk', 'IQF Flash Frozen Box', 'Grade #1', 'kg', 110, 93.60, 130, 150, 10, '1kg', '', 'Amans Ocean Coldstore · Abrepo, Barekese Rd', TRUE, TRUE, TRUE),
    (v_org_id, 'ao-sea-snails', 'AO-SEASNAIL-1KG', 'Sea Snails', 'sp-ao-sea-snails', 'Mollusk', 'IQF Flash Frozen Box', 'Grade #1', 'kg', 140, 28.80, 40, 40, 5, '1kg', '', 'Amans Ocean Coldstore · Abrepo, Barekese Rd', TRUE, TRUE, TRUE),
    (v_org_id, 'ao-sea-crabs', 'AO-SEACRAB-1KG', 'Sea Crabs', 'sp-ao-sea-crabs', 'Crustacean', 'IQF Flash Frozen Box', 'Grade #1', 'kg', 185, 21.60, 30, 30, 5, '1kg', '', 'Amans Ocean Coldstore · Abrepo, Barekese Rd', TRUE, TRUE, TRUE),
    (v_org_id, 'ao-lobsters', 'AO-LOBSTER-1KG', 'Lobsters', 'sp-ao-lobsters', 'Crustacean', 'Live in Oxygen Tank', 'Sashimi AAA', 'kg', 65, 129.60, 180, 180, 5, '1kg', '', 'Amans Ocean Coldstore · Abrepo, Barekese Rd', TRUE, TRUE, TRUE),
    (v_org_id, 'ao-grouper-fillet', 'AO-GRPFILLET-1KG', 'Grouper Fillet', 'sp-ao-grouper', 'Groundfish', 'Skin-On Loin / Fillet', 'Sashimi AAA', 'kg', 80, 158.40, 220, 220, 5, '1kg', '', 'Amans Ocean Coldstore · Abrepo, Barekese Rd', TRUE, TRUE, TRUE),
    (v_org_id, 'ao-grouper-chunks', 'AO-GRPCHUNKS-1KG', 'Grouper Chunks (No Head)', 'sp-ao-grouper', 'Groundfish', 'Headless & Gutted (H&G)', 'Grade #1', 'kg', 95, 108.00, 150, 150, 5, '1kg', '', 'Amans Ocean Coldstore · Abrepo, Barekese Rd', TRUE, TRUE, TRUE),
    (v_org_id, 'ao-fish-fillet-other', 'AO-OTRFILLET-1KG', 'Fish Fillet (Any Other Fish)', 'sp-ao-mixed-fillet', 'Groundfish', 'Skin-On Loin / Fillet', 'Grade #1', 'kg', 110, 108.00, 150, 150, 5, '1kg', '', 'Amans Ocean Coldstore · Abrepo, Barekese Rd', TRUE, TRUE, TRUE),
    (v_org_id, 'ao-doctor-fish', 'AO-DOCTORFISH-1KG', 'Doctor Fish', 'sp-ao-doctor-fish', 'Pelagic', 'Whole Round Fish', 'Grade #1', 'kg', 125, 72.00, 100, 100, 5, '1kg', '', 'Amans Ocean Coldstore · Abrepo, Barekese Rd', TRUE, TRUE, TRUE),
    (v_org_id, 'ao-fish-powder-regular', 'AO-FISHPWD-REG', 'Fish Powder (Regular Pack)', 'sp-ao-fish-powder', 'Pelagic', 'Packaged 500g Tray', 'Grade #1', 'pack', 100, 36.00, 50, 50, 5, 'Regular Pack', '', 'Amans Ocean Coldstore · Abrepo, Barekese Rd', TRUE, TRUE, TRUE),
    (v_org_id, 'ao-fish-powder-large', 'AO-FISHPWD-LRG', 'Fish Powder (Large Pack)', 'sp-ao-fish-powder', 'Pelagic', 'IQF Flash Frozen Box', 'Grade #1', 'pack', 80, 72.00, 100, 100, 5, 'Large Pack', '', 'Amans Ocean Coldstore · Abrepo, Barekese Rd', TRUE, TRUE, TRUE),
    (v_org_id, 'ao-shrimp-powder-regular', 'AO-SHRMPPWD-REG', 'Shrimp Powder (Regular Pack)', 'sp-ao-shrimp-powder', 'Crustacean', 'Packaged 500g Tray', 'Grade #1', 'pack', 100, 36.00, 50, 50, 5, 'Regular Pack', '', 'Amans Ocean Coldstore · Abrepo, Barekese Rd', TRUE, TRUE, TRUE),
    (v_org_id, 'ao-shrimp-powder-large', 'AO-SHRMPPWD-LRG', 'Shrimp Powder (Large Pack)', 'sp-ao-shrimp-powder', 'Crustacean', 'IQF Flash Frozen Box', 'Grade #1', 'pack', 80, 72.00, 100, 100, 5, 'Large Pack', '', 'Amans Ocean Coldstore · Abrepo, Barekese Rd', TRUE, TRUE, TRUE)
  ON CONFLICT (organization_id, id) DO UPDATE SET
    sku = EXCLUDED.sku,
    name = EXCLUDED.name,
    species_id = EXCLUDED.species_id,
    category = EXCLUDED.category,
    cut_type = EXCLUDED.cut_type,
    grade = EXCLUDED.grade,
    unit = EXCLUDED.unit,
    cost_price_per_unit = EXCLUDED.cost_price_per_unit,
    wholesale_price_per_unit = EXCLUDED.wholesale_price_per_unit,
    retail_price_per_unit = EXCLUDED.retail_price_per_unit,
    wholesale_min_qty = EXCLUDED.wholesale_min_qty,
    retail_pack_size = EXCLUDED.retail_pack_size,
    origin = EXCLUDED.origin,
    is_available_for_retail = TRUE,
    is_available_for_wholesale = TRUE,
    is_active = TRUE,
    updated_at = NOW();

  -- 5. Upsert linked cold-storage inventory batches so ERP stock & FEFO lot deduction match 1:1
  INSERT INTO public.inventory_batches (
    organization_id, id, species_id, species_name, scientific_name, category,
    harvest_date, landing_port, vessel_name, vessel_registration, captain_name,
    fao_area, gps_coordinates, location_description, gear_type, grade,
    initial_weight_kg, available_weight_kg, allocated_weight_kg, storage_zone,
    current_temp_celsius, target_temp_celsius, cost_per_kg, wholesale_price_per_kg,
    certifications, inspection_status, histamine_ppm, core_temp_celsius,
    received_date, expiry_date, qr_code_seed, notes, linked_product_id, product_sku, is_retail_cut_lot
  )
  SELECT
    p.organization_id,
    'LOT-' || UPPER(REPLACE(p.id, 'ao-', 'AO-')),
    p.species_id,
    COALESCE(s.name, p.name),
    COALESCE(s.scientific_name, 'Lutjanidae spp.'),
    p.category,
    CURRENT_DATE,
    'Port of Tema Coldstore Hub',
    'MV Amansocean Star',
    'GH-TMA-402',
    'Capt. Kwame Boateng',
    'FAO 34 Eastern Central Atlantic',
    '{"latitude": 5.6265, "longitude": 0.0061}'::jsonb,
    'Amans Ocean Coldstore · Abrepo, Barekese Rd',
    'IQF Cryo Line',
    p.grade,
    p.stock_kg,
    p.stock_kg,
    0,
    'Commercial Cold Storage (-22°C)',
    -22.4,
    -22.0,
    p.cost_price_per_unit,
    p.wholesale_price_per_unit,
    ARRAY['HACCP Certified', 'FDA Approved'],
    'Passed',
    4.5,
    -22.2,
    CURRENT_DATE,
    (CURRENT_DATE + INTERVAL '365 days')::DATE,
    'QR-' || UPPER(p.id),
    'Official Amans Ocean coldstore lot linked to ' || p.name,
    p.id,
    p.sku,
    TRUE
  FROM public.retail_wholesale_products p
  LEFT JOIN public.species s
    ON s.organization_id = p.organization_id AND s.id = p.species_id
  WHERE p.organization_id = v_org_id
    AND p.id LIKE 'ao-%'
  ON CONFLICT (organization_id, id) DO UPDATE SET
    available_weight_kg = EXCLUDED.available_weight_kg,
    initial_weight_kg = EXCLUDED.initial_weight_kg,
    cost_per_kg = EXCLUDED.cost_per_kg,
    wholesale_price_per_kg = EXCLUDED.wholesale_price_per_kg,
    linked_product_id = EXCLUDED.linked_product_id,
    product_sku = EXCLUDED.product_sku;

END $$;
