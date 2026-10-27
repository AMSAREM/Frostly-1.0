import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || 
  (typeof process !== 'undefined' && (process.env?.VITE_SUPABASE_URL || process.env?.SUPABASE_URL)) || 
  '';

const supabaseAnonKey = 
  (typeof import.meta !== 'undefined' && (
    import.meta.env?.VITE_SUPABASE_ANON_KEY || 
    import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY
  )) || 
  (typeof process !== 'undefined' && (
    process.env?.VITE_SUPABASE_ANON_KEY || 
    process.env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env?.SUPABASE_SERVICE_ROLE_KEY
  )) || 
  '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('placeholder') &&
  supabaseUrl.startsWith('https://')
);

// Fallback dummy client if env vars are missing to prevent runtime crash during build/lint
export const supabase = createClient(
  supabaseUrl || 'https://unconfigured.supabase.co',
  supabaseAnonKey || 'unconfigured-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);
