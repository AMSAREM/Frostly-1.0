import { HaccpAuditRecord } from '../types';

export interface DatabaseHaccpRow {
  id: string;
  lot_id: string;
  species_name: string;
  inspection_date: string;
  inspector_name: string;
  inspector_id: string;
  core_temperature: number | string;
  histamine_level_ppm: number | string;
  organoleptic_score: number | string;
  parasite_visual_check: string;
  sanitization_log_pass: boolean;
  final_compliance: string;
  certification_ref: string;
  notes?: string | null;
  created_at?: string;
  created_by?: string;
  organization_id?: string;
}

export const haccpMapper = {
  toDomain(row: DatabaseHaccpRow): HaccpAuditRecord {
    return {
      id: row.id,
      lotId: row.lot_id,
      speciesName: row.species_name,
      inspectionDate: row.inspection_date ? row.inspection_date.split('T')[0] : new Date().toISOString().split('T')[0],
      inspectorName: row.inspector_name || 'Inspector',
      inspectorId: row.inspector_id || 'AUD-001',
      coreTemperature: Number(row.core_temperature ?? 0),
      histamineLevelPpm: Number(row.histamine_level_ppm ?? 0),
      organolepticScore: Number(row.organoleptic_score ?? 10),
      parasiteVisualCheck: (row.parasite_visual_check as any) || 'Clean',
      sanitizationLogPass: Boolean(row.sanitization_log_pass),
      finalCompliance: (row.final_compliance as any) || 'Approved - Grade AAA',
      certificationRef: row.certification_ref || 'CERT-FDA-HAACP-2026',
      notes: row.notes || '',
    };
  },

  toDatabase(record: HaccpAuditRecord): Record<string, any> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(record.id);
    const payload: Record<string, any> = {
      lot_id: record.lotId,
      species_name: record.speciesName,
      inspection_date: record.inspectionDate || new Date().toISOString(),
      inspector_name: record.inspectorName,
      inspector_id: record.inspectorId,
      core_temperature: record.coreTemperature,
      histamine_level_ppm: record.histamineLevelPpm,
      organoleptic_score: record.organolepticScore,
      parasite_visual_check: record.parasiteVisualCheck,
      sanitization_log_pass: record.sanitizationLogPass,
      final_compliance: record.finalCompliance,
      certification_ref: record.certificationRef,
      notes: record.notes || null,
    };
    if (isUuid) {
      payload.id = record.id;
    }
    return payload;
  }
};
