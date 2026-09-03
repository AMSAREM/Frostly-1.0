-- ============================================================================
-- FROSTLY SEAFOOD COLD-CHAIN ERP
-- Migration 008: Supabase Realtime Replication Setup
-- ============================================================================

-- Enable Realtime publication strictly on the operational tables requiring
-- live telemetry and instantaneous UI dispatch updates.
-- Excludes immutable compliance tables (financial_ledger_entries, haccp_audit_records).

-- 1. Check or create supabase_realtime publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- 2. Add Live Telemetry & Dispatch Tables to Realtime Idempotently
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'reefer_sensor_readings'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.reefer_sensor_readings;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'system_notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.system_notifications;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'client_orders'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.client_orders;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'reefer_vehicles'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.reefer_vehicles;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'fleet_vessels'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.fleet_vessels;
    END IF;
END $$;
