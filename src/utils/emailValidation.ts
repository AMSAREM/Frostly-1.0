/**
 * Email Validation & Authentication Utilities for Frostly Seafood Platform
 * 
 * Enforces strict RFC-5322 compliance, domain validation, disposable/burner email detection,
 * and common typo prevention to guarantee genuine user identities.
 */

export interface EmailValidationResult {
  isValid: boolean;
  error: string | null;
  normalizedEmail: string;
  suggestion?: string | null;
  domain?: string;
}

// Comprehensive blacklist of temporary/disposable/burner email providers
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  '10minutemail.com',
  'tempmail.com',
  'temp-mail.org',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.biz',
  'guerrillamail.de',
  'sharklasers.com',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
  'trashmail.com',
  'trashmail.net',
  'dispostable.com',
  'throwawaymail.com',
  'fakeinbox.com',
  'getairmail.com',
  'burnermail.io',
  'mohmal.com',
  'crazymailing.com',
  'emailondeck.com',
  'generator.email',
  'dropmail.me',
  'inboxkitten.com',
  'mytemp.email',
  'tempail.com',
  'nada.ltd',
  'getnada.com',
  'tempinbox.com',
  'fakemailgenerator.com',
  'emailfake.com',
  'luxusmail.org',
  'zillamail.com',
]);

// Common domain typo mappings for smart correction hints
const TYPO_MAP: Record<string, string> = {
  'gmai.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmaik.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmaill.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yaho.co': 'yahoo.com',
  'outlok.com': 'outlook.com',
  'outloook.com': 'outlook.com',
  'outluk.com': 'outlook.com',
  'iclud.com': 'icloud.com',
  'icloude.com': 'icloud.com',
  'protomail.com': 'protonmail.com',
  'protonmai.com': 'protonmail.com',
};

// Strict RFC-compliant email regular expression
const RFC_EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Validates and normalizes an email address.
 * Rejects malformed strings, disposable burner accounts, and invalid top-level domains.
 */
export function validateEmail(input: string): EmailValidationResult {
  if (!input || typeof input !== 'string') {
    return {
      isValid: false,
      error: 'Email address is required',
      normalizedEmail: '',
    };
  }

  const trimmed = input.trim();
  const normalized = trimmed.toLowerCase();

  if (trimmed.length === 0) {
    return {
      isValid: false,
      error: 'Email address cannot be empty',
      normalizedEmail: '',
    };
  }

  if (trimmed.length > 254) {
    return {
      isValid: false,
      error: 'Email address exceeds maximum length of 254 characters',
      normalizedEmail: normalized,
    };
  }

  // Check for spaces
  if (/\s/.test(trimmed)) {
    return {
      isValid: false,
      error: 'Email address cannot contain spaces',
      normalizedEmail: normalized,
    };
  }

  // Check structure with RFC regex
  if (!RFC_EMAIL_REGEX.test(normalized)) {
    return {
      isValid: false,
      error: 'Please enter a valid email address (e.g., name@company.com)',
      normalizedEmail: normalized,
    };
  }

  const parts = normalized.split('@');
  if (parts.length !== 2) {
    return {
      isValid: false,
      error: 'Email address must contain exactly one "@" symbol',
      normalizedEmail: normalized,
    };
  }

  const [localPart, domain] = parts;

  // Validate local part
  if (localPart.length > 64) {
    return {
      isValid: false,
      error: 'The prefix before "@" cannot exceed 64 characters',
      normalizedEmail: normalized,
      domain,
    };
  }

  if (localPart.startsWith('.') || localPart.endsWith('.')) {
    return {
      isValid: false,
      error: 'Email cannot start or end with a period',
      normalizedEmail: normalized,
      domain,
    };
  }

  if (localPart.includes('..')) {
    return {
      isValid: false,
      error: 'Email cannot contain consecutive periods',
      normalizedEmail: normalized,
      domain,
    };
  }

  // Validate domain and TLD
  const domainParts = domain.split('.');
  const tld = domainParts[domainParts.length - 1];

  if (tld.length < 2) {
    return {
      isValid: false,
      error: 'Invalid top-level domain (e.g. .com, .org, .gh)',
      normalizedEmail: normalized,
      domain,
    };
  }

  // Check against disposable / burner email services
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return {
      isValid: false,
      error: 'Temporary and disposable email addresses are not permitted for cold-chain governance. Please use an authentic work or corporate email.',
      normalizedEmail: normalized,
      domain,
    };
  }

  // Check for common typos and suggest corrections
  let suggestion: string | null = null;
  if (TYPO_MAP[domain]) {
    suggestion = `${localPart}@${TYPO_MAP[domain]}`;
  }

  return {
    isValid: true,
    error: null,
    normalizedEmail: normalized,
    suggestion,
    domain,
  };
}

/**
 * Returns true if the email is structurally valid and not a disposable address.
 */
export function isEmailValid(email: string): boolean {
  return validateEmail(email).isValid;
}
