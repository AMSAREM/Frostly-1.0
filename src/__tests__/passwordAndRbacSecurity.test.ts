import { describe, it, expect } from 'vitest';
import { 
  validatePassword, 
  generateSecurePassword, 
  evaluatePasswordStrength 
} from '../utils/passwordValidation';
import { 
  canUserPerform, 
  normalizeRole, 
  getRoleBadgeInfo, 
  ROLE_DEFINITIONS 
} from '../utils/rbac';

describe('Password Validation & Enterprise Security Policy', () => {
  it('rejects passwords shorter than 8 characters', () => {
    const res = validatePassword('Pass1!');
    expect(res.isValid).toBe(false);
    expect(res.rules.minLength).toBe(false);
    expect(res.errorMessage).toContain('at least 8 characters');
  });

  it('rejects passwords missing uppercase characters', () => {
    const res = validatePassword('seafood#2026');
    expect(res.isValid).toBe(false);
    expect(res.rules.hasUppercase).toBe(false);
    expect(res.errorMessage).toContain('uppercase');
  });

  it('rejects passwords missing lowercase characters', () => {
    const res = validatePassword('SEAFOOD#2026');
    expect(res.isValid).toBe(false);
    expect(res.rules.hasLowercase).toBe(false);
    expect(res.errorMessage).toContain('lowercase');
  });

  it('rejects passwords missing numbers', () => {
    const res = validatePassword('Seafood#Freezer');
    expect(res.isValid).toBe(false);
    expect(res.rules.hasNumber).toBe(false);
    expect(res.errorMessage).toContain('number');
  });

  it('rejects passwords missing special characters/symbols', () => {
    const res = validatePassword('Seafood2026Ghana');
    expect(res.isValid).toBe(false);
    expect(res.rules.hasSymbol).toBe(false);
    expect(res.errorMessage).toContain('special character');
  });

  it('rejects passwords containing spaces', () => {
    const res = validatePassword('Frostly #2026Cold');
    expect(res.isValid).toBe(false);
    expect(res.rules.noSpaces).toBe(false);
    expect(res.errorMessage).toContain('spaces');
  });

  it('rejects common blacklisted passwords even if formatted', () => {
    const res = validatePassword('Password123!');
    expect(res.isValid).toBe(false);
    expect(res.rules.notCommon).toBe(false);
    expect(res.errorMessage).toContain('common');
  });

  it('accepts compliant enterprise passwords with high security score', () => {
    const res = validatePassword('Atlantic#Frost2026!');
    expect(res.isValid).toBe(true);
    expect(res.rules.minLength).toBe(true);
    expect(res.rules.hasUppercase).toBe(true);
    expect(res.rules.hasLowercase).toBe(true);
    expect(res.rules.hasNumber).toBe(true);
    expect(res.rules.hasSymbol).toBe(true);
    expect(res.rules.noSpaces).toBe(true);
    expect(res.rules.notCommon).toBe(true);
    expect(res.score).toBeGreaterThanOrEqual(80);
    expect(res.strength).toBe('strong');
  });

  it('generateSecurePassword generates 100% compliant passwords', () => {
    for (let i = 0; i < 10; i++) {
      const generated = generateSecurePassword(14);
      expect(generated.length).toBe(14);
      const res = validatePassword(generated);
      expect(res.isValid).toBe(true);
      expect(res.errorMessage).toBeNull();
    }
  });

  it('evaluatePasswordStrength assigns correct tiered levels', () => {
    expect(evaluatePasswordStrength(10)).toBe('very_weak');
    expect(evaluatePasswordStrength(30)).toBe('weak');
    expect(evaluatePasswordStrength(50)).toBe('fair');
    expect(evaluatePasswordStrength(70)).toBe('good');
    expect(evaluatePasswordStrength(90)).toBe('strong');
  });
});

describe('Role-Based Access Control (RBAC) & Authorisation Matrix', () => {
  it('normalizes legacy and mixed-case roles correctly', () => {
    expect(normalizeRole('ADMIN')).toBe('admin');
    expect(normalizeRole('Platform Owner')).toBe('creator');
    expect(normalizeRole('operator')).toBe('ops_staff');
    expect(normalizeRole('logistics')).toBe('dispatch_staff');
    expect(normalizeRole('sales')).toBe('sales_staff');
    expect(normalizeRole('auditor')).toBe('viewer');
    expect(normalizeRole('unknown_role')).toBe('viewer');
    expect(normalizeRole(undefined)).toBe('viewer');
  });

  it('allows creator to perform all actions including platform management', () => {
    expect(canUserPerform('creator', 'manage_platform')).toBe(true);
    expect(canUserPerform('creator', 'manage_workers')).toBe(true);
    expect(canUserPerform('creator', 'create_batch')).toBe(true);
    expect(canUserPerform('creator', 'create_order')).toBe(true);
    expect(canUserPerform('creator', 'view_financial_reports')).toBe(true);
  });

  it('allows tenant admin to manage workers, settings and view financials, but NOT manage platform', () => {
    expect(canUserPerform('admin', 'manage_platform')).toBe(false);
    expect(canUserPerform('admin', 'manage_workers')).toBe(true);
    expect(canUserPerform('admin', 'manage_settings')).toBe(true);
    expect(canUserPerform('admin', 'create_batch')).toBe(true);
    expect(canUserPerform('admin', 'create_order')).toBe(true);
  });

  it('allows ops_staff to log catch batches and adjust inventory, but NOT manage workers or settings', () => {
    expect(canUserPerform('ops_staff', 'create_batch')).toBe(true);
    expect(canUserPerform('ops_staff', 'adjust_inventory')).toBe(true);
    expect(canUserPerform('ops_staff', 'record_haccp')).toBe(true);
    expect(canUserPerform('ops_staff', 'manage_workers')).toBe(false);
    expect(canUserPerform('ops_staff', 'manage_settings')).toBe(false);
    expect(canUserPerform('ops_staff', 'create_order')).toBe(false);
  });

  it('allows sales_staff to create orders and process POS sales, but NOT adjust inventory or create batches', () => {
    expect(canUserPerform('sales_staff', 'create_order')).toBe(true);
    expect(canUserPerform('sales_staff', 'process_pos_sale')).toBe(true);
    expect(canUserPerform('sales_staff', 'manage_customers')).toBe(true);
    expect(canUserPerform('sales_staff', 'create_batch')).toBe(false);
    expect(canUserPerform('sales_staff', 'adjust_inventory')).toBe(false);
    expect(canUserPerform('sales_staff', 'manage_workers')).toBe(false);
  });

  it('restricts viewer / auditor role to read-only capabilities', () => {
    expect(canUserPerform('viewer', 'view_financial_reports')).toBe(true);
    expect(canUserPerform('viewer', 'create_batch')).toBe(false);
    expect(canUserPerform('viewer', 'create_order')).toBe(false);
    expect(canUserPerform('viewer', 'manage_workers')).toBe(false);
    expect(canUserPerform('viewer', 'adjust_inventory')).toBe(false);
  });

  it('provides badge info for all defined roles', () => {
    const roles: Array<keyof typeof ROLE_DEFINITIONS> = ['creator', 'admin', 'ops_staff', 'sales_staff', 'dispatch_staff', 'viewer'];
    roles.forEach(role => {
      const info = getRoleBadgeInfo(role);
      expect(info.label).toBeDefined();
      expect(info.badgeBg).toBeDefined();
      expect(info.badgeText).toBeDefined();
    });
  });

  it('enforces that only admin and creator roles can manage workers and reset worker passwords', () => {
    expect(canUserPerform('admin', 'manage_workers')).toBe(true);
    expect(canUserPerform('creator', 'manage_workers')).toBe(true);
    expect(canUserPerform('ops_staff', 'manage_workers')).toBe(false);
    expect(canUserPerform('sales_staff', 'manage_workers')).toBe(false);
    expect(canUserPerform('dispatch_staff', 'manage_workers')).toBe(false);
    expect(canUserPerform('viewer', 'manage_workers')).toBe(false);
  });

  it('validates every password for strict criteria across all onboarding flows', () => {
    const weakPasswords = ['123456', 'password', 'frostly', 'seafood123', 'admin123', 'NoNumber!'];
    weakPasswords.forEach(pwd => {
      const check = validatePassword(pwd);
      expect(check.isValid).toBe(false);
      expect(check.errorMessage).toBeTruthy();
    });

    const compliantPasswords = ['TemaHarbour#2026', 'OceanCold$Chain99', 'Atlantic@Freezer1'];
    compliantPasswords.forEach(pwd => {
      const check = validatePassword(pwd);
      expect(check.isValid).toBe(true);
      expect(check.errorMessage).toBeNull();
    });
  });
});

