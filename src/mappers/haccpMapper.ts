import { HaccpAuditRecord } from '../types';
import { ensureValidUuid } from './notificationMapper';

const VALID_HACCP_COMPLIANCE = new Set<string>([
  'Approved - Grade AAA',
  'Approved - Standard',
  'Quarantine - Re-inspect',
  'Rejected',
]);

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
      inspectionDate: row.inspection_date
        ? row.inspection_date.split('T')[0]
        : new Date().toISOString().split('T')[0],
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
    const cleanCompliance = VALID_HACCP_COMPLIANCE.has(record.finalCompliance)
      ? record.finalCompliance
      : 'Approved - Standard';

    return {
      id: ensureValidUuid(record.id || `haccp-${Date.now()}`),
      lot_id: record.lotId,
      species_name: record.speciesName,
      inspection_date: record.inspectionDate || new Date().toISOString(),
      inspector_name: record.inspectorName || 'Quality Inspector',
      inspector_id: record.inspectorId || 'AUD-001',
      core_temperature: Number(record.coreTemperature ?? -22),
      histamine_level_ppm: Math.max(0, Number(record.histamineLevelPpm ?? 0)),
      organoleptic_score: Math.min(10, Math.max(1, Number(record.organolepticScore ?? 10))),
      parasite_visual_check: record.parasiteVisualCheck || 'Clean',
      sanitization_log_pass: Boolean(record.sanitizationLogPass),
      final_compliance: cleanCompliance,
      certification_ref: record.certificationRef || 'CERT-FDA-HACCP',
      notes: record.notes || null,
    };
  },
};
