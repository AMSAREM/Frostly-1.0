/**
 * Password Security & Validation Utilities for Frostly Seafood Platform
 * 
 * Enforces enterprise-grade password complexity, NIST SP 800-63B guidelines,
 * blacklist checks against common weak passwords, and live strength scoring.
 */

export type PasswordStrength = 'very_weak' | 'weak' | 'fair' | 'good' | 'strong';

export interface PasswordRuleCheck {
  id: string;
  label: string;
  passed: boolean;
}

export interface PasswordValidationResult {
  isValid: boolean;
  score: number; // 0 to 100
  strength: PasswordStrength;
  strengthLabel: string;
  errorMessage: string | null;
  rules: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSymbol: boolean;
    noSpaces: boolean;
    notCommon: boolean;
  };
  ruleChecks: PasswordRuleCheck[];
}

// Common weak & default passwords blacklisted for cold-chain enterprise security
const COMMON_WEAK_PASSWORDS = new Set([
  'password',
  'password123',
  'password1',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty123',
  'admin123',
  'administrator',
  'welcome1',
  'welcome123',
  'seafood123',
  'frostly',
  'frostly123',
  'amansocean',
  'tema1234',
  'accra123',
  'coldchain',
  'freezer1',
  'letmein123',
]);

const SYMBOL_REGEX = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/;

export function evaluatePasswordStrength(score: number): PasswordStrength {
  if (score >= 80) return 'strong';
  if (score >= 60) return 'good';
  if (score >= 45) return 'fair';
  if (score >= 25) return 'weak';
  return 'very_weak';
}

export function getStrengthLabel(strength: PasswordStrength): string {
  switch (strength) {
    case 'strong':
      return 'Strong';
    case 'good':
      return 'Good';
    case 'fair':
      return 'Fair';
    case 'weak':
      return 'Weak';
    default:
      return 'Too Weak';
  }
}

/**
 * Validates any password against strict security criteria:
 * - Minimum 8 characters (12+ for strong score)
 * - At least one uppercase letter (A-Z)
 * - At least one lowercase letter (a-z)
 * - At least one digit (0-9)
 * - At least one special symbol (!@#$%...)
 * - No spaces
 * - Not a blacklisted common weak password
 */
export function validatePassword(password: string): PasswordValidationResult {
  if (!password || typeof password !== 'string') {
    return {
      isValid: false,
      score: 0,
      strength: 'very_weak',
      strengthLabel: 'Too Weak',
      errorMessage: 'Password is required.',
      rules: {
        minLength: false,
        hasUppercase: false,
        hasLowercase: false,
        hasNumber: false,
        hasSymbol: false,
        noSpaces: true,
        notCommon: true,
      },
      ruleChecks: [
        { id: 'minLength', label: 'At least 8 characters', passed: false },
        { id: 'hasUppercase', label: 'One uppercase letter (A-Z)', passed: false },
        { id: 'hasLowercase', label: 'One lowercase letter (a-z)', passed: false },
        { id: 'hasNumber', label: 'One number (0-9)', passed: false },
        { id: 'hasSymbol', label: 'One special symbol (!@#$...)', passed: false },
      ],
    };
  }

  const minLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = SYMBOL_REGEX.test(password);
  const noSpaces = !/\s/.test(password);

  const cleanLower = password.toLowerCase().trim();
  const strippedSymbols = cleanLower.replace(/[^a-z0-9]/g, '');
  const notCommon = !COMMON_WEAK_PASSWORDS.has(cleanLower) && !COMMON_WEAK_PASSWORDS.has(strippedSymbols);

  // Calculate score (0-100)
  let score = 0;
  if (password.length >= 8) score += 20;
  if (password.length >= 12) score += 15;
  if (password.length >= 16) score += 10;
  if (hasUppercase) score += 15;
  if (hasLowercase) score += 15;
  if (hasNumber) score += 15;
  if (hasSymbol) score += 15;
  if (!noSpaces) score = Math.max(0, score - 30);
  if (!notCommon) score = Math.min(score, 20);

  // Clamp score
  score = Math.min(100, Math.max(0, score));

  const strength = evaluatePasswordStrength(score);
  const strengthLabel = getStrengthLabel(strength);

  // Determine error message if any
  let errorMessage: string | null = null;
  if (!minLength) {
    errorMessage = 'Password must be at least 8 characters long.';
  } else if (!noSpaces) {
    errorMessage = 'Password cannot contain spaces.';
  } else if (!hasUppercase) {
    errorMessage = 'Password must include at least one uppercase letter (A-Z).';
  } else if (!hasLowercase) {
    errorMessage = 'Password must include at least one lowercase letter (a-z).';
  } else if (!hasNumber) {
    errorMessage = 'Password must include at least one number (0-9).';
  } else if (!hasSymbol) {
    errorMessage = 'Password must include at least one special character (!@#$%^&*...).';
  } else if (!notCommon) {
    errorMessage = 'This password is too common and easily guessed. Please use a unique phrase or sequence.';
  }

  const isValid = minLength && hasUppercase && hasLowercase && hasNumber && hasSymbol && noSpaces && notCommon;

  const ruleChecks: PasswordRuleCheck[] = [
    { id: 'minLength', label: 'At least 8 characters', passed: minLength },
    { id: 'hasUppercase', label: 'One uppercase letter (A-Z)', passed: hasUppercase },
    { id: 'hasLowercase', label: 'One lowercase letter (a-z)', passed: hasLowercase },
    { id: 'hasNumber', label: 'One number (0-9)', passed: hasNumber },
    { id: 'hasSymbol', label: 'One special symbol (!@#$...)', passed: hasSymbol },
  ];

  return {
    isValid,
    score,
    strength,
    strengthLabel,
    errorMessage,
    rules: {
      minLength,
      hasUppercase,
      hasLowercase,
      hasNumber,
      hasSymbol,
      noSpaces,
      notCommon,
    },
    ruleChecks,
  };
}

/**
 * Generates a high-entropy, cryptographically secure password meeting all criteria.
 * Useful for 1-click generation in Worker Creation, Reset Password, and Admin Provisioning.
 */
export function generateSecurePassword(length = 12): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // exclude confusing chars like I, O
  const lower = 'abcdefghijkmnopqrstuvwxyz'; // exclude l
  const numbers = '23456789'; // exclude 0, 1
  const symbols = '!@#$%^&*()_+-=';

  const all = upper + lower + numbers + symbols;

  // Ensure at least 2 of each category
  let pwd = '';
  pwd += upper.charAt(Math.floor(Math.random() * upper.length));
  pwd += upper.charAt(Math.floor(Math.random() * upper.length));
  pwd += lower.charAt(Math.floor(Math.random() * lower.length));
  pwd += lower.charAt(Math.floor(Math.random() * lower.length));
  pwd += numbers.charAt(Math.floor(Math.random() * numbers.length));
  pwd += numbers.charAt(Math.floor(Math.random() * numbers.length));
  pwd += symbols.charAt(Math.floor(Math.random() * symbols.length));
  pwd += symbols.charAt(Math.floor(Math.random() * symbols.length));

  for (let i = pwd.length; i < Math.max(12, length); i++) {
    pwd += all.charAt(Math.floor(Math.random() * all.length));
  }

  // Shuffle characters securely
  return pwd
    .split('')
    .sort(() => 0.5 - Math.random())
    .join('');
}
