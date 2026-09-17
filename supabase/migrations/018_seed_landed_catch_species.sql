-- ============================================================================
-- FROSTLY SEAFOOD COLD-CHAIN ERP
-- Migration 018: Ensure Catch Intake Fallback Species ('spec-landed')
-- ============================================================================

DO $$
DECLARE
    org_rec RECORD;
BEGIN
    FOR org_rec IN SELECT id FROM public.organizations LOOP
        INSERT INTO public.species (
            organization_id, id, name, scientific_name, category,
            default_zone, standard_price_per_kg, available_grades,
            fao_zones, gear_types, seasonal_peak, image,
            shelf_life_fresh_days, shelf_life_frozen_months, is_active
        ) VALUES (
            org_rec.id,
            'spec-landed',
            'General Landed Biomass',
            'Harvest Catch Provenance',
            'Pelagic',
            'Commercial Cold Storage (-22°C)',
            25.00,
            ARRAY['Grade #1', 'Grade #2']::public.quality_grade[],
            ARRAY['FAO 61', 'FAO 71'],
            ARRAY['Certified Sustainable Gear'],
            'Year-Round',
            'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=600&q=80',
            7,
            12,
            TRUE
        )
        ON CONFLICT (organization_id, id) DO NOTHING;
    END LOOP;
END $$;
