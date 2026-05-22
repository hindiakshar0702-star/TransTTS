# PhonePe Payment Gateway Setup

This guide walks through enabling **PhonePe Payments** in TransTTS as
the second payment provider alongside Razorpay. The integration uses
PhonePe's Standard Checkout (PG) API.

> If you haven't already set up Razorpay, see
> [`RAZORPAY_SETUP.md`](./RAZORPAY_SETUP.md) — both providers share the
> same `Order` table and success/receipt page.

---

## 0. How the integration is wired

The flow is **fundamentally different** from Razorpay's modal flow:

```
Razorpay (modal):                PhonePe (full-page redirect):

  /upgrade                         /upgrade
     │ click Pay                      │ click Pay
     ▼                                ▼
  /api/razorpay/create-order       /api/phonepe/create-order
     │ get orderId                    │ get redirectUrl
     ▼                                ▼
  Razorpay modal opens             window.location = redirectUrl
     │ user pays                      │
     ▼                                ▼
  client handler →                 PhonePe checkout page
  /api/razorpay/verify             (UPI / Card / NetBanking)
     │ HMAC verify                    │
     ▼                                ▼
  /upgrade/success                 /api/phonepe/callback
                                      │ status API check
                                      ▼
                                   /upgrade/success

         (Plus async S2S webhook → /api/phonepe/webhook for both)
```

The provider toggle on `/upgrade` is automatic — it shows only when
**both** providers are configured server-side. With only one
configured, that one is used silently.

---

## 1. Create a PhonePe Business account

1. Sign up at <https://business.phonepe.com>.
2. You'll get **UAT (sandbox)** access immediately — no KYC required
   for testing.
3. For production:
   - Submit business KYC (PAN, GST/MSME proof, bank account).
   - Approval typically takes **2–7 business days**.
   - Live merchant ID is issued once approved.

---

## 2. Get your credentials

### A) Quick start: skip account creation (UAT only)

For UAT testing you can just **leave PhonePe env vars unset** in
`.env.local`. The app will fall back to PhonePe's public sandbox
credentials:

```
Merchant ID: PGTESTPAYUAT
Salt Key:    099eb0cd-02cf-4e2a-8aca-3e6c6aff0399
Salt Index:  1
Endpoint:    https://api-preprod.phonepe.com/apis/pg-sandbox
```

These are documented by PhonePe and only work against the sandbox
endpoint — they cannot move real money.

### B) Your own credentials

1. PhonePe Business dashboard → **Developer Settings → API Keys** (or
   <https://business.phonepe.com/developer/setting>).
2. Copy:
   - **Merchant ID** (e.g. `M22ABCDEF12345`)
   - **Salt Key** (UUID-ish secret string)
   - **Salt Index** (usually `1`)

UAT and Production keys are **different** — keep them separated by
environment.

---

## 3. Configure environment variables

Copy `.env.example` to `.env.local` and add:

```bash
# Where redirect/callback URLs point. Required for PhonePe.
NEXT_PUBLIC_APP_URL=http://localhost:3000

# PhonePe (leave blank in dev to use public UAT creds)
PHONEPE_MERCHANT_ID=
PHONEPE_SALT_KEY=
PHONEPE_SALT_INDEX=1
PHONEPE_ENV=UAT          # or PROD
```

> The merchant ID and salt key are **server-side secrets** — never
> prefix them with `NEXT_PUBLIC_`. The frontend doesn't need them
> directly; it only calls our server routes.

---

## 4. Run the database migration

The PhonePe integration adds new columns to the `Order` table.

```bash
npm install                    # postinstall runs prisma generate
npx prisma migrate dev         # applies the new migration
```

The migration is additive + nullable, so existing Razorpay orders are
preserved.

---

## 5. Test the flow in UAT

```bash
npm run dev
```

1. Open <http://localhost:3000/pricing> and click **Upgrade to Pro**.
2. On `/upgrade`, fill name, email, optional 10-digit mobile.
3. If both providers are configured, the **provider toggle** appears
   above the order summary. Pick **PhonePe**.
4. Click **Pay ₹X with PhonePe**.
5. You'll be **full-page redirected** to PhonePe's sandbox checkout.
6. Test instruments (UAT only):

   | Method | Value | Result |
   |--------|-------|--------|
   | UPI    | `success@ybl`  | ✅ Success |
   | UPI    | `failure@ybl`  | ❌ Failure |
   | Card   | `4242 4242 4242 4242`, any future expiry, CVV 936 | ✅ Success |
   | Card   | `5453 0100 8400 0001`, any future expiry, CVV 936 | ❌ Failure |

   > These match PhonePe's published sandbox values; verify against
   > <https://developer.phonepe.com/v1/reference/test-instrument>
   > if anything fails.

7. After payment, PhonePe redirects you back to
   `/api/phonepe/callback?orderId=<UUID>`, which calls the **/status
   API** server-to-server, updates the `Order` row, then 303-redirects
   to `/upgrade/success`.

8. Receipt page shows:
   - **PhonePe Order ID** (your `MT_…` merchantTransactionId)
   - **PhonePe Transaction ID** (`T…` from PhonePe)
   - **UPI / Bank reference** (when present)
   - Plan, amount, GST, valid-until date

---

## 6. Set up the S2S webhook (recommended)

The browser redirect can be unreliable (user closes tab, network
drops). The S2S webhook makes payment state authoritative.

### What we expose

```
POST /api/phonepe/webhook
Headers:  X-VERIFY: <signature>
Body:     { "response": "<base64-encoded-payload>" }
```

The route:
- Re-computes the signature over `base64Response + saltKey`.
- Timing-safe-compares against the `X-VERIFY` header.
- Decodes the base64 payload to JSON.
- Updates the matching `Order` (idempotent — re-deliveries are no-ops).
- Returns `200` even on duplicates (so PhonePe stops retrying).

### Local testing with ngrok

PhonePe can't reach `localhost`. Tunnel:

```bash
npx ngrok http 3000
```

Copy the HTTPS forwarding URL and either:

- Set `NEXT_PUBLIC_APP_URL=https://abcd-1234.ngrok.io` and restart
  `npm run dev` (preferred — every flow uses the same base URL), or
- Pass it explicitly per request.

The webhook URL is sent to PhonePe in the `callbackUrl` field of
`/api/phonepe/create-order`'s payload, so as long as
`NEXT_PUBLIC_APP_URL` (or x-forwarded headers) point to the tunnel,
PhonePe will hit your local server.

### Configure in PhonePe Business dashboard (optional)

If you prefer dashboard-configured webhooks instead of per-request
`callbackUrl`:

1. PhonePe Business → **Developer → Webhooks → Add new webhook**.
2. URL: `https://<your-host>/api/phonepe/webhook`
3. Choose event types (PhonePe sends all by default).
4. The signing secret is the **same Salt Key** you already use — no
   separate webhook secret.

---

## 7. Going live (production)

1. Complete PhonePe KYC and obtain live credentials.
2. In Vercel → **Project → Settings → Environment Variables**, set
   the **Production** scope only:

   | Variable                    | Value                                           |
   |-----------------------------|-------------------------------------------------|
   | `PHONEPE_MERCHANT_ID`       | live merchant ID (not `PGTESTPAYUAT`)           |
   | `PHONEPE_SALT_KEY`          | live salt key                                   |
   | `PHONEPE_SALT_INDEX`        | usually `1`                                     |
   | `PHONEPE_ENV`               | `PROD`                                          |
   | `NEXT_PUBLIC_APP_URL`       | `https://your-production-domain`                |

3. Leave `Preview` and `Development` Vercel environments using UAT
   creds (or the public sandbox fallback) so test branches can never
   accidentally charge a real card.

4. Re-deploy.

> ⚠️ Double-check `PHONEPE_ENV=PROD` is **only** set in Production.
> If left as `UAT` in production, payments will go to the sandbox
> endpoint and won't actually charge users.

---

## 8. Troubleshooting

| Symptom                                         | Fix                                                                                  |
|-------------------------------------------------|--------------------------------------------------------------------------------------|
| `503 Payment gateway not configured` on /upgrade| Restart `npm run dev` after editing `.env.local`. Vars are read at boot.            |
| PhonePe checkout opens but says "Invalid X-VERIFY" | Wrong `PHONEPE_SALT_KEY` or wrong `PHONEPE_ENV`. UAT keys won't work in PROD.    |
| Browser redirects to `/upgrade/success?failed=1`| Real failure — check `errorMsg` in DB or PhonePe dashboard logs.                    |
| Browser redirects to `/upgrade/success?pending=1`| Webhook not yet delivered. The page auto-shows a manual refresh button.            |
| Webhook returns `400 Invalid signature`         | `PHONEPE_SALT_KEY` mismatch with the dashboard. Re-copy.                            |
| Order stuck in `created` status forever         | Webhook URL unreachable. Check ngrok / `NEXT_PUBLIC_APP_URL` / firewall.            |
| Provider toggle doesn't appear                  | Only one provider configured. Set both Razorpay + PhonePe env vars to see toggle.  |
| Wrong `redirectUrl`/`callbackUrl` sent to PhonePe| Set `NEXT_PUBLIC_APP_URL` explicitly. Auto-detect from headers can be wrong on Vercel. |

---

## 9. Files involved

```
src/
├── lib/
│   └── phonepe.ts                          # Config, X-VERIFY helpers
└── app/
    ├── api/
    │   ├── orders/[id]/route.ts            # GET — unified order lookup
    │   ├── payment-providers/route.ts      # GET — which providers configured
    │   └── phonepe/
    │       ├── create-order/route.ts       # POST — initiate /pg/v1/pay
    │       ├── callback/route.ts           # GET+POST — browser redirect target
    │       └── webhook/route.ts            # POST — S2S X-VERIFY notification
    └── upgrade/
        ├── page.tsx                        # Provider toggle + Pay button
        └── success/page.tsx                # Receipt (provider-aware)

prisma/
├── schema.prisma                            # Order.provider + phonepe fields
└── migrations/
    └── 20260522103000_add_phonepe_provider/migration.sql
```

---

## 10. Security notes

- All four PhonePe routes run with `runtime = "nodejs"` because they
  use `crypto`.
- The `webhook` route uses `dynamic = "force-dynamic"` so the body is
  read raw (`req.text()`) — any reparse would invalidate the signature.
- Signature compares are **timing-safe** (`crypto.timingSafeEqual`)
  to prevent leak-via-latency attacks.
- The `GET /api/orders/[id]` response **never** exposes
  `razorpaySignature`, `webhookEvent`, or salt-derived values.
- The PhonePe public test creds are intentionally checked into
  `src/lib/phonepe.ts` because PhonePe themselves publish them — they
  only authorise the sandbox endpoint and cannot be used in PROD.
