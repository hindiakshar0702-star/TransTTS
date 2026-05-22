import crypto from "crypto";

/**
 * PhonePe Payment Gateway helpers.
 *
 * API docs: https://developer.phonepe.com/v1/reference/pay-api/
 *
 * Three signed flows:
 *   1. /pg/v1/pay (POST)         — initiate payment, X-VERIFY over base64(payload) + path + salt
 *   2. /pg/v1/status/{m}/{t}     — server poll, X-VERIFY over path + salt (no body)
 *   3. S2S webhook (incoming)    — body is { response: base64(...) }, X-VERIFY over base64Response + salt
 *
 * All three share the same SHA256 + "###" + saltIndex format.
 */

export type PhonePeEnv = "UAT" | "PROD";

const ENDPOINTS: Record<PhonePeEnv, string> = {
  UAT: "https://api-preprod.phonepe.com/apis/pg-sandbox",
  PROD: "https://api.phonepe.com/apis/hermes",
};

/**
 * Public PhonePe test credentials. These are documented by PhonePe and are
 * safe to commit (everyone uses them in UAT). They only work against the
 * sandbox endpoint and never move real money. Fallback so devs can test
 * without signing up.
 */
const PUBLIC_TEST_CREDS = {
  merchantId: "PGTESTPAYUAT",
  saltKey: "099eb0cd-02cf-4e2a-8aca-3e6c6aff0399",
  saltIndex: "1",
};

export interface PhonePeConfig {
  env: PhonePeEnv;
  merchantId: string;
  saltKey: string;
  saltIndex: string;
  baseUrl: string;
  /** True when env vars are explicitly set (vs falling back to public UAT). */
  hasOwnCreds: boolean;
}

export function getPhonePeConfig(): PhonePeConfig {
  const env = (process.env.PHONEPE_ENV === "PROD" ? "PROD" : "UAT") as PhonePeEnv;
  const merchantId = process.env.PHONEPE_MERCHANT_ID?.trim() || PUBLIC_TEST_CREDS.merchantId;
  const saltKey = process.env.PHONEPE_SALT_KEY?.trim() || PUBLIC_TEST_CREDS.saltKey;
  const saltIndex = process.env.PHONEPE_SALT_INDEX?.trim() || PUBLIC_TEST_CREDS.saltIndex;
  const hasOwnCreds = Boolean(
    process.env.PHONEPE_MERCHANT_ID && process.env.PHONEPE_SALT_KEY
  );
  return {
    env,
    merchantId,
    saltKey,
    saltIndex,
    baseUrl: ENDPOINTS[env],
    hasOwnCreds,
  };
}

/**
 * Whether the operator has configured their own PhonePe creds.
 * The frontend uses this to decide whether to surface PhonePe in the
 * provider toggle. The public UAT creds will technically work too, but
 * we don't want to ship them as a default visible option in production.
 */
export function isPhonePeConfigured(): boolean {
  if (process.env.PHONEPE_MERCHANT_ID && process.env.PHONEPE_SALT_KEY) return true;
  // In non-production environments allow the public sandbox creds so
  // developers can demo the flow end-to-end without signing up.
  return process.env.NODE_ENV !== "production";
}

/* -------------------------------------------------------------------- */
/* X-VERIFY signature helpers                                           */
/* -------------------------------------------------------------------- */

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/**
 * X-VERIFY for endpoints that take a body (e.g. POST /pg/v1/pay).
 * Format: sha256(base64Payload + path + saltKey) + "###" + saltIndex
 */
export function computeXVerifyForPay(
  base64Payload: string,
  apiPath: string,
  saltKey: string,
  saltIndex: string
): string {
  const sig = sha256Hex(base64Payload + apiPath + saltKey);
  return `${sig}###${saltIndex}`;
}

/**
 * X-VERIFY for endpoints that have no body (e.g. GET /pg/v1/status/...).
 * Format: sha256(path + saltKey) + "###" + saltIndex
 */
export function computeXVerifyForStatus(
  apiPath: string,
  saltKey: string,
  saltIndex: string
): string {
  const sig = sha256Hex(apiPath + saltKey);
  return `${sig}###${saltIndex}`;
}

/**
 * X-VERIFY check for incoming S2S webhook callbacks.
 * PhonePe POSTs `{ response: "<base64...>" }` plus header X-VERIFY.
 * Format: sha256(base64Response + saltKey) + "###" + saltIndex
 *
 * Uses timing-safe comparison.
 */
export function verifyWebhookSignature(
  base64Response: string,
  providedSignature: string,
  saltKey: string,
  saltIndex: string
): boolean {
  const expected = `${sha256Hex(base64Response + saltKey)}###${saltIndex}`;
  if (expected.length !== providedSignature.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(providedSignature)
  );
}

/* -------------------------------------------------------------------- */
/* Misc helpers                                                          */
/* -------------------------------------------------------------------- */

/**
 * Generates a unique merchantTransactionId for PhonePe orders.
 * Constraints (per PhonePe docs):
 *   - max 38 chars
 *   - alphanumeric, hyphen, underscore
 */
export function generateMerchantTransactionId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(6).toString("hex").toUpperCase();
  return `MT_${ts}_${rand}`.slice(0, 38);
}

/**
 * Helper to base64-encode a JSON-serialisable payload (used for /pay body).
 */
export function encodePayload(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

/**
 * Helper to base64-decode a webhook response payload back to JSON.
 */
export function decodeResponse<T = unknown>(base64Response: string): T {
  const raw = Buffer.from(base64Response, "base64").toString("utf8");
  return JSON.parse(raw) as T;
}
