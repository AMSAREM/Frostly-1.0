import { InventoryBatch, SpeciesCategory, QualityGrade, StorageZone } from '../types';

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
      notes: row.notes ?? '',
    };
  },

  /**
   * Convert a domain InventoryBatch to Supabase database row payload
   */
  toDatabase(batch: InventoryBatch): Record<string, any> {
    return {
      id: batch.id,
      species_id: batch.speciesId,
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
      notes: batch.notes || null,
    };
  },
};
