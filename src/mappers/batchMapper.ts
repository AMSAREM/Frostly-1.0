import { InventoryBatch, SpeciesCategory, QualityGrade, StorageZone } from '../types';
import { getSpeciesIdFromName } from '../utils/speciesHelper';

export interface DatabaseInventoryBatchRow {
  id: string;
  species_id: string;
  species_name: string;
  scientific_name: string;
  category: string;
  harvest_date: string;
  landing_port: string;
  vessel_name: string;
  vessel_registration: string;
  captain_name: string;
  fao_area: string;
  gps_coordinates: {
    latitude?: number;
    longitude?: number;
    lat?: number;
    lng?: number;
  } | null;
  location_description: string | null;
  gear_type: string;
  grade: string;
  initial_weight_kg: number | string;
  available_weight_kg: number | string;
  allocated_weight_kg: number | string;
  storage_zone: string;
  current_temp_celsius: number | string;
  target_temp_celsius: number | string;
  cost_per_kg: number | string;
  wholesale_price_per_kg: number | string;
  certifications: string[] | null;
  inspection_status: string;
  histamine_ppm: number | string | null;
  core_temp_celsius: number | string;
  received_date: string;
  expiry_date: string;
  qr_code_seed: string;
  notes: string | null;
  linked_product_id?: string | null;
  product_sku?: string | null;
  is_retail_cut_lot?: boolean | null;
  created_at?: string;
  updated_at?: string;
  // Optional join fields for relations if populated
  species?: {
    id?: string;
    name?: string;
    scientific_name?: string;
    category?: string;
  } | null;
}

export const batchMapper = {
  /**
   * Convert a Supabase database row (with optional species join) to domain InventoryBatch
   */
  toDomain(row: DatabaseInventoryBatchRow): InventoryBatch {
    const lat = Number(row.gps_coordinates?.latitude ?? row.gps_coordinates?.lat ?? 0);
    const lng = Number(row.gps_coordinates?.longitude ?? row.gps_coordinates?.lng ?? 0);
    const description = row.location_description ?? '';

    // Gracefully handle species join if present, else fallback to denormalized row attributes
    const speciesName = row.species?.name ?? row.species_name ?? 'Unknown Species';
    const scientificName = row.species?.scientific_name ?? row.scientific_name ?? '';
    const category = (row.species?.category ?? row.category ?? 'Pelagic') as SpeciesCategory;

    let isRetailCutLot = Boolean(row.is_retail_cut_lot);
    let linkedProductId = row.linked_product_id || undefined;
    let productSku = row.product_sku || undefined;
    let rawNotes = row.notes ?? '';

    // Parse structured metadata embedded in notes if present
    if (rawNotes.includes('<!--frostly_retail:')) {
      try {
        const match = rawNotes.match(/<!--frostly_retail:(\{.*?\})-->/);
        if (match && match[1]) {
          const parsed = JSON.parse(match[1]);
          if (parsed.isRetailCutLot !== undefined && !isRetailCutLot) isRetailCutLot = Boolean(parsed.isRetailCutLot);
          if (parsed.linkedProductId && !linkedProductId) linkedProductId = parsed.linkedProductId;
          if (parsed.productSku && !productSku) productSku = parsed.productSku;
          rawNotes = rawNotes.replace(/<!--frostly_retail:.*?-->/, '').trim();
        }
      } catch {
        // ignore parse error
      }
    }

    if (!isRetailCutLot && (row.id?.startsWith('LOT-RET') || (rawNotes && rawNotes.toLowerCase().includes('retail cut')))) {
      isRetailCutLot = true;
    }

    return {
      id: row.id,
      speciesId: row.species_id,
      speciesName,
      scientificName,
      category,
      harvestDate: row.harvest_date,
      landingPort: row.landing_port,
      vesselName: row.vessel_name,
      vesselRegistration: row.vessel_registration,
      captainName: row.captain_name,
      faoArea: row.fao_area,
      coordinates: {
        lat,
        lng,
        description,
      },
      gearType: row.gear_type,
      grade: row.grade as QualityGrade,
      initialWeightKg: Number(row.initial_weight_kg) || 0,
      availableWeightKg: Number(row.available_weight_kg) || 0,
      allocatedWeightKg: Number(row.allocated_weight_kg) || 0,
      storageZone: row.storage_zone as StorageZone,
      currentTempCelsius: Number(row.current_temp_celsius) || 0,
      targetTempCelsius: Number(row.target_temp_celsius) || 0,
      costPerKg: Number(row.cost_per_kg) || 0,
      wholesalePricePerKg: Number(row.wholesale_price_per_kg) || 0,
      certifications: Array.isArray(row.certifications) ? row.certifications : [],
      inspectionStatus: (row.inspection_status as 'Passed' | 'Pending' | 'Flagged') || 'Pending',
      histaminePpm: row.histamine_ppm != null ? Number(row.histamine_ppm) : undefined,
      coreTempCelsius: Number(row.core_temp_celsius) || 0,
      receivedDate: row.received_date,
      expiryDate: row.expiry_date,
      qrCodeSeed: row.qr_code_seed || row.id,
      notes: rawNotes,
      linkedProductId,
      productSku,
      isRetailCutLot,
    };
  },

  /**
   * Convert a domain InventoryBatch to Supabase database row payload.
   * Embeds retail cut linkage metadata into notes so that existing schemas without
   * is_retail_cut_lot or linked_product_id columns retain 100% data fidelity.
   */
  toDatabase(batch: InventoryBatch): Record<string, any> {
    let cleanNotes = batch.notes || '';
    if (cleanNotes.includes('<!--frostly_retail:')) {
      cleanNotes = cleanNotes.replace(/<!--frostly_retail:.*?-->/, '').trim();
    }

    if (batch.isRetailCutLot || batch.linkedProductId || batch.productSku) {
      const meta = JSON.stringify({
        isRetailCutLot: Boolean(batch.isRetailCutLot),
        linkedProductId: batch.linkedProductId || null,
        productSku: batch.productSku || null,
      });
      cleanNotes = cleanNotes ? `${cleanNotes} <!--frostly_retail:${meta}-->` : `<!--frostly_retail:${meta}-->`;
    }

    const payload: Record<string, any> = {
      id: batch.id,
      species_id: getSpeciesIdFromName(batch.speciesName, batch.speciesId),
      species_name: batch.speciesName,
      scientific_name: batch.scientificName,
      category: batch.category,
      harvest_date: batch.harvestDate,
      landing_port: batch.landingPort,
      vessel_name: batch.vesselName,
      vessel_registration: batch.vesselRegistration,
      captain_name: batch.captainName,
      fao_area: batch.faoArea,
      gps_coordinates: {
        latitude: batch.coordinates?.lat ?? 0,
        longitude: batch.coordinates?.lng ?? 0,
      },
      location_description: batch.coordinates?.description || null,
      gear_type: batch.gearType,
      grade: batch.grade,
      initial_weight_kg: batch.initialWeightKg,
      available_weight_kg: batch.availableWeightKg,
      allocated_weight_kg: batch.allocatedWeightKg,
      storage_zone: batch.storageZone,
      current_temp_celsius: batch.currentTempCelsius,
      target_temp_celsius: batch.targetTempCelsius,
      cost_per_kg: batch.costPerKg,
      wholesale_price_per_kg: batch.wholesalePricePerKg,
      certifications: batch.certifications || [],
      inspection_status: batch.inspectionStatus,
      histamine_ppm: batch.histaminePpm ?? null,
      core_temp_celsius: batch.coreTempCelsius,
      received_date: batch.receivedDate,
      expiry_date: batch.expiryDate,
      qr_code_seed: batch.qrCodeSeed || batch.id,
      notes: cleanNotes || null,
    };

    return payload;
  },
};
