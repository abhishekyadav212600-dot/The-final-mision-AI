// Validation constants synchronized verbatim with firebase-blueprint.json & firestore.rules
export const UID_PATTERN = /^[a-zA-Z0-9_-]+$/;
export const UID_MAX_LENGTH = 128;
export const DISPLAY_NAME_MAX_LENGTH = 120;
export const EMAIL_MAX_LENGTH = 254;
export const PROBE_LABEL_MIN_LENGTH = 1;
export const PROBE_LABEL_MAX_LENGTH = 160;

const EMAIL_FORMAT_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface PasswordStrengthResult {
  valid: boolean;
  score: number;
  checks: {
    minLength: boolean;
    hasUpper: boolean;
    hasLower: boolean;
    hasNumber: boolean;
    hasSpecial: boolean;
  };
  errors: string[];
}

export function isValidFirebaseId(id: string): boolean {
  return typeof id === 'string' && id.length >= 1 && id.length <= UID_MAX_LENGTH && UID_PATTERN.test(id);
}

export function validateEmail(email: string): { valid: boolean; normalized: string; error?: string } {
  const normalized = email.trim();
  if (!normalized) {
    return { valid: false, normalized, error: 'Email address is required.' };
  }
  if (normalized.length > EMAIL_MAX_LENGTH) {
    return { valid: false, normalized, error: `Email must be at most ${EMAIL_MAX_LENGTH} characters.` };
  }
  if (!EMAIL_FORMAT_REGEX.test(normalized)) {
    return { valid: false, normalized, error: 'Enter a valid email address.' };
  }
  return { valid: true, normalized };
}

export function validatePasswordStrength(password: string): PasswordStrengthResult {
  const checks = {
    minLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password)
  };

  const errors: string[] = [];
  if (!checks.minLength) errors.push('At least 8 characters');
  if (!checks.hasUpper) errors.push('One uppercase letter');
  if (!checks.hasLower) errors.push('One lowercase letter');
  if (!checks.hasNumber) errors.push('One number');
  if (!checks.hasSpecial) errors.push('One special character');

  const score = Object.values(checks).filter(Boolean).length;
  return {
    valid: errors.length === 0,
    score,
    checks,
    errors
  };
}

export function sanitizeDisplayName(name: string): string {
  return name.trim().slice(0, DISPLAY_NAME_MAX_LENGTH);
}

export function sanitizeProbeLabel(label: string): string {
  return label.trim().slice(0, PROBE_LABEL_MAX_LENGTH);
}
