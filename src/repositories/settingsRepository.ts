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

  private getScopedStorageKey(orgId?: string): string {
    const activeOrg = orgId || getCurrentOrganizationId();
    if (activeOrg && activeOrg !== 'org-frostly-hq' && activeOrg !== '00000000-0000-0000-0000-000000000001') {
      return `${STORAGE_KEY}__tenant_${activeOrg}`;
    }
    return `${STORAGE_KEY}__demo`;
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

    if (isSupabaseConfigured) {
      try {
        const dbPayload: Record<string, any> = { ...settingsMapper.toDatabase(settings) };
        if (!dbPayload.organization_id) {
          dbPayload.organization_id = orgId;
        }

        const { error } = await supabase
          .from('app_settings')
          .upsert(dbPayload, { onConflict: 'organization_id,id' });

        if (error) {
          console.warn('[SettingsRepository] Error upserting app_settings:', error);
        }
      } catch (err) {
        console.warn('[SettingsRepository] Network error saving app_settings:', err);
      }
    }

    return settings;
  }

  private getLocalCache(orgId?: string): AppSettings | null {
    try {
      const key = this.getScopedStorageKey(orgId);
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private setLocalCache(settings: AppSettings, orgId?: string): void {
    try {
      const key = this.getScopedStorageKey(orgId);
      localStorage.setItem(key, JSON.stringify(settings));
    } catch (e) {
      console.warn('[SettingsRepository] Error writing local cache:', e);
    }
  }
}

export const settingsRepository = new SettingsRepository();
