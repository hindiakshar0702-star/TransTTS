/**
 * Shared password policy — imported by BOTH server routes (register / reset) and
 * the client login UI (strength meter). Pure TypeScript, no node/edge-only APIs,
 * so it is safe in any runtime. The server is the source of truth: the client
 * uses this only for live feedback and MUST NOT be trusted for enforcement.
 */

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 200;

/**
 * Small blocklist of the most abused passwords / obvious patterns. This is a
 * deliberately tiny, high-signal list (not a full dictionary) so it stays cheap
 * to check on every request. Compared case-insensitively.
 */
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "12345678", "123456789", "1234567890",
  "qwerty", "qwerty123", "qwertyuiop", "111111", "000000", "abc12345",
  "iloveyou", "admin", "admin123", "letmein", "welcome", "welcome1",
  "monkey", "dragon", "sunshine", "princess", "football", "baseball",
  "trustno1", "passw0rd", "p@ssw0rd", "changeme", "secret", "master",
]);

export interface PasswordCheck {
  ok: boolean;
  /** Human-readable failures, safe to show to the user. */
  errors: string[];
}

/**
 * Enforce the password policy. Requirements:
 *   - length 8–200
 *   - at least one lowercase, one uppercase, and one digit
 *   - not in the common-password blocklist
 *   - not identical to the email local-part (when supplied)
 */
export function validatePassword(password: string, email?: string): PasswordCheck {
  const errors: string[] = [];

  if (password.length < PASSWORD_MIN) {
    errors.push(`Use at least ${PASSWORD_MIN} characters.`);
  }
  if (password.length > PASSWORD_MAX) {
    errors.push(`Keep it under ${PASSWORD_MAX} characters.`);
  }
  if (!/[a-z]/.test(password)) errors.push("Add a lowercase letter.");
  if (!/[A-Z]/.test(password)) errors.push("Add an uppercase letter.");
  if (!/[0-9]/.test(password)) errors.push("Add a number.");

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push("This password is too common — choose something less guessable.");
  }

  if (email) {
    const local = email.split("@")[0]?.trim().toLowerCase();
    if (local && local.length >= 3 && password.toLowerCase() === local) {
      errors.push("Password must not match your email.");
    }
  }

  return { ok: errors.length === 0, errors };
}

export type StrengthLabel = "Too weak" | "Weak" | "Fair" | "Good" | "Strong";

export interface PasswordStrength {
  /** 0–4, for driving a meter width/colour. */
  score: number;
  label: StrengthLabel;
}

/**
 * Cheap heuristic strength estimate for the live UI meter (NOT security
 * enforcement — validatePassword does that). Rewards length and character
 * variety, penalises the common-password blocklist.
 */
export function passwordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, label: "Too weak" };
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return { score: 0, label: "Too weak" };

  let score = 0;
  if (password.length >= PASSWORD_MIN) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  score = Math.min(score, 4);
  const labels: StrengthLabel[] = ["Too weak", "Weak", "Fair", "Good", "Strong"];
  return { score, label: labels[score] };
}
