import { AppSettings } from '../types';
import { settingsMapper, DatabaseAppSettingsRow } from '../mappers/settingsMapper';
import { supabase, isSupabaseConfigured } from '../utils/supabase';

const STORAGE_KEY = 'frostly_settings_v3';

export class SettingsRepository {
  public async getSettings(fallback: AppSettings): Promise<AppSettings> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('*')
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          const domainSettings = settingsMapper.toDomain(data as DatabaseAppSettingsRow);
          this.setLocalCache(domainSettings);
          return domainSettings;
        }
      } catch (err) {
        console.warn('[SettingsRepository] Error reading from Supabase:', err);
      }
    }

    const cached = this.getLocalCache();
    return cached || fallback;
  }

  public async saveSettings(settings: AppSettings): Promise<AppSettings> {
    this.setLocalCache(settings);

    if (isSupabaseConfigured) {
      try {
        const dbPayload = settingsMapper.toDatabase(settings);
        const { error } = await supabase
          .from('app_settings')
          .upsert(dbPayload, { onConflict: 'id' });

        if (error) {
          console.warn('[SettingsRepository] Error upserting app_settings:', error);
        }
      } catch (err) {
        console.warn('[SettingsRepository] Network error saving app_settings:', err);
      }
    }

    return settings;
  }

  private getLocalCache(): AppSettings | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private setLocalCache(settings: AppSettings): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('[SettingsRepository] Error writing local cache:', e);
    }
  }
}

export const settingsRepository = new SettingsRepository();
