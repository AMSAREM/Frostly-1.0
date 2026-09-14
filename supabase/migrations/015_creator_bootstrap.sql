-- ============================================================================
-- FROSTLY SEAFOOD COLD-CHAIN ERP
-- Migration 015: Platform Creator Credentials & Backend Identity Bootstrapping
-- ============================================================================

-- Ensure pgcrypto extension is available for cryptographic password hashing
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- ----------------------------------------------------------------------------
-- 1. Backend RPC: Bootstrap or Reset Platform Creator Credentials Out-of-Band
-- ----------------------------------------------------------------------------
-- Note: In accordance with security mandates, NO plaintext credentials or passwords
-- are committed to migration scripts. Initial creator setup is executed out-of-band
-- by the database administrator or deployment pipeline calling this procedure with
-- securely supplied credentials (e.g. from environment variables).

CREATE OR REPLACE FUNCTION public.bootstrap_platform_creator(
    p_email TEXT,
    p_password TEXT,
    p_notes TEXT DEFAULT 'Platform Creator & Multi-Tenant Operator'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_user_id UUID;
    v_hashed_pw TEXT;
BEGIN
    -- Validation: Email and Password must be provided
    IF p_email IS NULL OR TRIM(p_email) = '' THEN
        RAISE EXCEPTION 'Platform creator email must not be empty';
    END IF;

    IF p_password IS NULL OR LENGTH(p_password) < 8 THEN
        RAISE EXCEPTION 'Password must be provided and be at least 8 characters in length';
    END IF;

    -- Compute cryptographic bcrypt hash using standard PostgreSQL Blowfish salt (from extensions schema)
    BEGIN
        v_hashed_pw := extensions.crypt(p_password, extensions.gen_salt('bf', 10));
    EXCEPTION WHEN OTHERS THEN
        v_hashed_pw := crypt(p_password, gen_salt('bf', 10));
    END;

    -- Check if user identity already exists in Supabase auth.users
    SELECT id INTO v_user_id 
    FROM auth.users 
    WHERE LOWER(email) = LOWER(TRIM(p_email));

    IF v_user_id IS NULL THEN
        v_user_id := gen_random_uuid();
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            v_user_id,
            'authenticated',
            'authenticated',
            LOWER(TRIM(p_email)),
            v_hashed_pw,
            NOW(),
            '{"provider":"email","providers":["email"],"role":"platform_creator"}'::jsonb,
            jsonb_build_object('full_name', 'Platform Creator', 'platform_owner', true, 'role', 'platform_creator'),
            NOW(),
            NOW()
        );
    ELSE
        UPDATE auth.users
        SET 
            encrypted_password = v_hashed_pw,
            email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
            raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role":"platform_creator"}'::jsonb,
            raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"platform_owner":true,"role":"platform_creator"}'::jsonb,
            updated_at = NOW()
        WHERE id = v_user_id;
    END IF;

    -- Ensure platform_admins entry is present
    INSERT INTO public.platform_admins (user_id, created_at, created_by, notes)
    VALUES (v_user_id, NOW(), v_user_id, p_notes)
    ON CONFLICT (user_id) DO UPDATE
    SET notes = p_notes;

    RETURN jsonb_build_object(
        'success', true,
        'user_id', v_user_id,
        'email', LOWER(TRIM(p_email)),
        'is_platform_admin', true,
        'stored_at_backend', true,
        'updated_at', NOW()
    );
END;
$$;

-- Security note: revoke public execute, grant only to authenticated (if creator) and service_role
REVOKE ALL ON FUNCTION public.bootstrap_platform_creator(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_platform_creator(TEXT, TEXT, TEXT) TO authenticated, service_role;

