import { AppSettings } from '../types';

export interface DatabaseAppSettingsRow {
  id: number;
  company_name: string;
  facility_code: string;
  fda_registration_number: string;
  eu_approval_number: string;
  haccp_coordinator: string;
  primary_port: string;
  tax_rate: number | string;
  currency: string;
  super_cryo_target_c: number | string;
  super_cryo_max_alert_c: number | string;
  commercial_freeze_target_c: number | string;
  commercial_freeze_max_alert_c: number | string;
  slush_ice_target_c: number | string;
  slush_ice_max_alert_c: number | string;
  histamine_limit_ppm: number | string;
  sensor_polling_interval_sec: number | string;
  enable_audio_alerts: boolean;
  use_imperial: boolean;
  weight_decimal_places: number | string;
  date_format: string;
  default_payment_terms: string;
  auto_generate_qr_traceability: boolean;
  ice_packaging_fee_per_kg: number | string;
  min_order_value_wholesale: number | string;
  notify_haccp_excursion: boolean;
  notify_low_inventory: boolean;
  notify_overdue_invoices: boolean;
  notify_vessel_arrivals: boolean;
  low_stock_threshold_kg: number | string;
  organization_id?: string;
  updated_at?: string;
}

export const settingsMapper = {
  toDomain(row: DatabaseAppSettingsRow): AppSettings {
    return {
      companyName: row.company_name,
      facilityCode: row.facility_code,
      fdaRegistrationNumber: row.fda_registration_number,
      euApprovalNumber: row.eu_approval_number,
      haccpCoordinator: row.haccp_coordinator,
      primaryPort: row.primary_port,
      taxRate: Number(row.tax_rate ?? 5),
      currency: (row.currency as any) || 'USD',
      superCryoTargetC: Number(row.super_cryo_target_c ?? -60),
      superCryoMaxAlertC: Number(row.super_cryo_max_alert_c ?? -50),
      commercialFreezeTargetC: Number(row.commercial_freeze_target_c ?? -22),
      commercialFreezeMaxAlertC: Number(row.commercial_freeze_max_alert_c ?? -18),
      slushIceTargetC: Number(row.slush_ice_target_c ?? 0.5),
      slushIceMaxAlertC: Number(row.slush_ice_max_alert_c ?? 3.0),
      histamineLimitPpm: Number(row.histamine_limit_ppm ?? 50),
      sensorPollingIntervalSec: Number(row.sensor_polling_interval_sec ?? 30),
      enableAudioAlerts: Boolean(row.enable_audio_alerts),
      useImperial: Boolean(row.use_imperial),
      weightDecimalPlaces: Number(row.weight_decimal_places ?? 1),
      dateFormat: (row.date_format as any) || 'YYYY-MM-DD',
      defaultPaymentTerms: row.default_payment_terms || 'Net 30 Days',
      autoGenerateQRTraceability: Boolean(row.auto_generate_qr_traceability),
      icePackagingFeePerKg: Number(row.ice_packaging_fee_per_kg ?? 0.45),
      minOrderValueWholesale: Number(row.min_order_value_wholesale ?? 300),
      notifyHaccpExcursion: Boolean(row.notify_haccp_excursion),
      notifyLowInventory: Boolean(row.notify_low_inventory),
      notifyOverdueInvoices: Boolean(row.notify_overdue_invoices),
      notifyVesselArrivals: Boolean(row.notify_vessel_arrivals),
      lowStockThresholdKg: Number(row.low_stock_threshold_kg ?? 200),
    };
  },

  toDatabase(domain: AppSettings): Partial<DatabaseAppSettingsRow> {
    return {
      id: 1,
      company_name: domain.companyName,
      facility_code: domain.facilityCode,
      fda_registration_number: domain.fdaRegistrationNumber,
      eu_approval_number: domain.euApprovalNumber,
      haccp_coordinator: domain.haccpCoordinator,
      primary_port: domain.primaryPort,
      tax_rate: domain.taxRate,
      currency: domain.currency,
      super_cryo_target_c: domain.superCryoTargetC,
      super_cryo_max_alert_c: domain.superCryoMaxAlertC,
      commercial_freeze_target_c: domain.commercialFreezeTargetC,
      commercial_freeze_max_alert_c: domain.commercialFreezeMaxAlertC,
      slush_ice_target_c: domain.slushIceTargetC,
      slush_ice_max_alert_c: domain.slushIceMaxAlertC,
      histamine_limit_ppm: domain.histamineLimitPpm,
      sensor_polling_interval_sec: domain.sensorPollingIntervalSec,
      enable_audio_alerts: domain.enableAudioAlerts,
      use_imperial: domain.useImperial,
      weight_decimal_places: domain.weightDecimalPlaces,
      date_format: domain.dateFormat,
      default_payment_terms: domain.defaultPaymentTerms,
      auto_generate_qr_traceability: domain.autoGenerateQRTraceability,
      ice_packaging_fee_per_kg: domain.icePackagingFeePerKg,
      min_order_value_wholesale: domain.minOrderValueWholesale,
      notify_haccp_excursion: domain.notifyHaccpExcursion,
      notify_low_inventory: domain.notifyLowInventory,
      notify_overdue_invoices: domain.notifyOverdueInvoices,
      notify_vessel_arrivals: domain.notifyVesselArrivals,
      low_stock_threshold_kg: domain.lowStockThresholdKg,
      updated_at: new Date().toISOString(),
    };
  },
};
