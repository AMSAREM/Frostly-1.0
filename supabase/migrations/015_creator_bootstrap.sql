-- ============================================================================
-- FROSTLY SEAFOOD COLD-CHAIN ERP
-- Migration 015: Platform Creator Credentials & Backend Identity Bootstrapping
-- ============================================================================

-- Ensure pgcrypto extension is available for cryptographic password hashing
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. Automated Creator Identity Provisioning into auth.users and platform_admins
-- ----------------------------------------------------------------------------

DO $$
DECLARE
    v_creator_id UUID := 'c0000000-0000-0000-0000-000000000001';
    v_creator_email TEXT := 'creator@frostly.io';
    v_creator_raw_pw TEXT := 'FrostlyCreator2026!';
    v_hashed_pw TEXT;
    v_existing_id UUID;
BEGIN
    -- Compute cryptographic bcrypt hash using standard PostgreSQL Blowfish salt
    v_hashed_pw := crypt(v_creator_raw_pw, gen_salt('bf', 10));

    -- Check if user identity already exists in Supabase auth.users
    SELECT id INTO v_existing_id 
    FROM auth.users 
    WHERE LOWER(email) = LOWER(v_creator_email);

    IF v_existing_id IS NULL THEN
        -- Insert into backend auth.users with pre-confirmed email and active session eligibility
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            invited_at,
            confirmation_token,
            confirmation_sent_at,
            recovery_token,
            recovery_sent_at,
            email_change_token_new,
            email_change,
            email_change_sent_at,
            last_sign_in_at,
            raw_app_meta_data,
            raw_user_meta_data,
            is_super_admin,
            created_at,
            updated_at,
            phone,
            phone_confirmed_at,
            phone_change,
            phone_change_token,
            phone_change_sent_at,
            email_change_token_current,
            email_change_confirm_status,
            banned_until,
            reauthentication_token,
            reauthentication_sent_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            v_creator_id,
            'authenticated',
            'authenticated',
            v_creator_email,
            v_hashed_pw,
            NOW(),
            NULL,
            '',
            NULL,
            '',
            NULL,
            '',
            '',
            NULL,
            NULL,
            '{"provider":"email","providers":["email"],"role":"platform_creator"}'::jsonb,
            '{"full_name":"Frostly Platform Creator","role":"platform_creator","platform_owner":true}'::jsonb,
            FALSE,
            NOW(),
            NOW(),
            NULL,
            NULL,
            '',
            '',
            NULL,
            '',
            0,
            NULL,
            '',
            NULL
        );
    ELSE
        -- Update password to ensure backend credentials stay in sync
        v_creator_id := v_existing_id;
        UPDATE auth.users
        SET 
            encrypted_password = v_hashed_pw,
            email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
            raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role":"platform_creator"}'::jsonb,
            raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"platform_owner":true}'::jsonb,
            updated_at = NOW()
        WHERE id = v_creator_id;
    END IF;

    -- Ensure platform creator is stamped in public.platform_admins
    INSERT INTO public.platform_admins (
        user_id,
        created_at,
        created_by,
        notes
    ) VALUES (
        v_creator_id,
        NOW(),
        v_creator_id,
        'Frostly Primary Platform Creator & Global Multi-Tenant Operator'
    )
    ON CONFLICT (user_id) DO UPDATE
    SET notes = 'Frostly Primary Platform Creator & Global Multi-Tenant Operator';

END $$;

-- ----------------------------------------------------------------------------
-- 2. Backend RPC: Bootstrap or Reset Platform Creator Credentials
-- ----------------------------------------------------------------------------
-- This function allows server-side administration and password rotation
-- exclusively for the postgres / service_role context.

CREATE OR REPLACE FUNCTION public.bootstrap_platform_creator(
    p_email TEXT DEFAULT 'creator@frostly.io',
    p_password TEXT DEFAULT 'FrostlyCreator2026!',
    p_notes TEXT DEFAULT 'Platform Creator & Multi-Tenant Operator'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID;
    v_hashed_pw TEXT;
BEGIN
    -- Must have at least 8 characters
    IF LENGTH(p_password) < 8 THEN
        RAISE EXCEPTION 'Password must be at least 8 characters in length';
    END IF;

    v_hashed_pw := crypt(p_password, gen_salt('bf', 10));

    SELECT id INTO v_user_id 
    FROM auth.users 
    WHERE LOWER(email) = LOWER(p_email);

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
            p_email,
            v_hashed_pw,
            NOW(),
            '{"provider":"email","providers":["email"],"role":"platform_creator"}'::jsonb,
            jsonb_build_object('full_name', 'Platform Creator', 'platform_owner', true),
            NOW(),
            NOW()
        );
    ELSE
        UPDATE auth.users
        SET 
            encrypted_password = v_hashed_pw,
            email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
            raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role":"platform_creator"}'::jsonb,
            raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"platform_owner":true}'::jsonb,
            updated_at = NOW()
        WHERE id = v_user_id;
    END IF;

    -- Ensure platform_admins entry
    INSERT INTO public.platform_admins (user_id, created_at, notes)
    VALUES (v_user_id, NOW(), p_notes)
    ON CONFLICT (user_id) DO UPDATE
    SET notes = p_notes;

    RETURN jsonb_build_object(
        'success', true,
        'user_id', v_user_id,
        'email', p_email,
        'is_platform_admin', true,
        'stored_at_backend', true,
        'updated_at', NOW()
    );
END;
$$;

-- Security note: revoke public execute, grant only to authenticated (if creator) and service_role
REVOKE ALL ON FUNCTION public.bootstrap_platform_creator(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_platform_creator(TEXT, TEXT, TEXT) TO authenticated;
