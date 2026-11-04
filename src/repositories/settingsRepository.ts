import { AppSettings } from '../types';
import { settingsMapper, DatabaseAppSettingsRow } from '../mappers/settingsMapper';
import { supabase, isSupabaseConfigured } from '../utils/supabase';
import { getStaffProfile, getCurrentOrganizationId } from '../data/auth';

const STORAGE_KEY = 'frostly_settings_v3';

export class SettingsRepository {
  private async getOrganizationId(): Promise<string> {
    try {
      const profile = await getStaffProfile();
      if (profile?.organization_id && profile.organization_id !== 'org-frostly-hq') {
        return profile.organization_id;
      }
    } catch {
      // ignore
    }
    return getCurrentOrganizationId();
  }

  private getScopedStorageKey(orgId?: string): string | null {
    const activeOrg = orgId || getCurrentOrganizationId();
    if (activeOrg && activeOrg !== 'org-frostly-hq' && activeOrg !== '00000000-0000-0000-0000-000000000000') {
      return `${STORAGE_KEY}__tenant_${activeOrg}`;
    }
    return null;
  }

  public async getSettings(fallback: AppSettings): Promise<AppSettings> {
    const orgId = await this.getOrganizationId();
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('*')
          .eq('organization_id', orgId)
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          const domainSettings = settingsMapper.toDomain(data as DatabaseAppSettingsRow);
          this.setLocalCache(domainSettings, orgId);
          return domainSettings;
        }
      } catch (err) {
        console.warn('[SettingsRepository] Error reading from Supabase:', err);
      }
    }

    const cached = this.getLocalCache(orgId);
    return cached || fallback;
  }

  public async saveSettings(settings: AppSettings): Promise<AppSettings> {
    const orgId = await this.getOrganizationId();
    this.setLocalCache(settings, orgId);

    if (isSupabaseConfigured && orgId && orgId !== 'org-frostly-hq' && orgId !== '00000000-0000-0000-0000-000000000000') {
      try {
        const dbPayload: Record<string, any> = { ...settingsMapper.toDatabase(settings) };
        delete dbPayload.id; // Do not hardcode id; allow existing row id to be preserved
        dbPayload.organization_id = orgId;

        // Use UPDATE first to conform to RLS UPDATE policy
        const { data: updatedRows, error: updateErr } = await supabase
          .from('app_settings')
          .update(dbPayload)
          .eq('organization_id', orgId)
          .select('id');

        if (updateErr) {
          // If RLS denies update (e.g. non-admin viewer or expired token), record warning
          console.warn('[SettingsRepository] Supabase settings update notice:', updateErr.message);
        } else if (!updatedRows || updatedRows.length === 0) {
          // If no row exists yet for this organization, attempt insert with id = 1
          dbPayload.id = 1;
          const { error: insertErr } = await supabase
            .from('app_settings')
            .upsert(dbPayload, { onConflict: 'organization_id,id' });
          if (insertErr) {
            console.warn('[SettingsRepository] Supabase settings fallback notice:', insertErr.message);
          }
        }
      } catch (err: any) {
        console.warn('[SettingsRepository] Network error saving app_settings:', err?.message || err);
      }
    }

    return settings;
  }

  public getLocalCache(orgId?: string): AppSettings | null {
    try {
      const key = this.getScopedStorageKey(orgId);
      if (!key) return null;
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  public setLocalCache(settings: AppSettings, orgId?: string): void {
    try {
      const key = this.getScopedStorageKey(orgId);
      if (!key) return;
      localStorage.setItem(key, JSON.stringify(settings));
    } catch (e) {
      console.warn('[SettingsRepository] Error writing local cache:', e);
    }
  }
}

export const settingsRepository = new SettingsRepository();
