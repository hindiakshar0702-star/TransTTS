import { z } from "zod";

/**
 * E.164 phone validation: a leading "+", a non-zero country code, then 7–14
 * more digits (max 15 total). Whitespace is stripped before checking so users
 * can paste "+91 98765 43210". Shared by the mobile-OTP routes.
 */
export const e164Schema = z
  .string()
  .trim()
  .transform((s) => s.replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^\+[1-9]\d{7,14}$/, "Enter a valid phone number in E.164 format (e.g. +919876543210)."));
