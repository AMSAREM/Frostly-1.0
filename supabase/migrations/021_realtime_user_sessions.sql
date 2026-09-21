-- ============================================================================
-- FROSTLY SEAFOOD COLD-CHAIN ERP
-- Migration 021: Realtime Replication for User Sessions & Presence Tracking
-- ============================================================================

-- 1. Ensure user_login_logs table has full replica identity so payload updates include all fields
ALTER TABLE public.user_login_logs REPLICA IDENTITY FULL;

-- 2. Add user_login_logs to the supabase_realtime publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'user_login_logs'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.user_login_logs;
    END IF;
END $$;

-- 3. Function to update a user's session status in realtime
CREATE OR REPLACE FUNCTION public.update_user_session_status(
    p_log_id UUID,
    p_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.user_login_logs
    SET session_status = p_status
    WHERE id = p_log_id
      AND (user_id = auth.uid() OR public.is_platform_admin());
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_user_session_status(UUID, TEXT) TO authenticated;
