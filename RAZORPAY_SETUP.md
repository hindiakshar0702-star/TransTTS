# Razorpay Payment Setup

This guide walks through enabling **real working payments** in TransTTS,
including local testing with Razorpay test mode and production deployment.

---

## 1. Create a Razorpay account

1. Sign up at <https://dashboard.razorpay.com/signup>.
2. You'll start in **Test Mode** by default — no KYC needed for testing.
3. For production, complete KYC (PAN, bank account, business proof).
   Activation usually takes 1–2 business days.

---

## 2. Get your API keys

1. In the Razorpay dashboard, switch to **Test Mode** (toggle top-right).
2. Go to **Account & Settings → API Keys** (or
   <https://dashboard.razorpay.com/app/keys>).
3. Click **Generate Test Key**.
4. Copy the `Key ID` (starts with `rzp_test_`) and the `Key Secret`.
   The secret is shown **only once** — save it.

---

## 3. Configure environment variables

Copy `.env.example` to `.env.local` and fill in:

```bash
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx   # same as KEY_ID
RAZORPAY_WEBHOOK_SECRET=anything_long_and_random
DATABASE_URL="file:./dev.db"
```

> The `NEXT_PUBLIC_` variant is needed because the Razorpay checkout SDK
> runs in the browser and needs the public Key ID. The **secret must
> never** be prefixed with `NEXT_PUBLIC_`.

---

## 4. Run the database migration

The integration adds a new `Order` table.

```bash
npm install                         # installs deps + runs prisma generate
npx prisma migrate dev --name init  # applies migrations to dev.db
```

If you change the database to Postgres later, edit
`prisma/schema.prisma`'s `provider` to `postgresql` and re-run the
migrate command.

---

## 5. Start the dev server and test a payment

```bash
npm run dev
```

1. Open <http://localhost:3000/pricing> and click **Upgrade to Pro**.
2. Enter any name & email.
3. Click **Pay ₹X with Razorpay**.
4. The Razorpay modal opens. Use a **test card**:

   | Card type     | Number              | Expiry | CVV  |
   |---------------|---------------------|--------|------|
   | Visa success  | `4111 1111 1111 1111` | Any future | `123` |
   | Mastercard    | `5267 3181 8797 5449` | Any future | `123` |
   | Failure       | `4000 0000 0000 0002` | Any future | `123` |

   For UPI test, use VPA `success@razorpay` (or `failure@razorpay`).
   Full list: <https://razorpay.com/docs/payments/payments/test-card-upi-details/>.

5. After payment, you'll be redirected to `/upgrade/success` showing
   the receipt. The `Order` row in the DB will be marked `status="paid"`
   with a `validUntil` 30 / 365 days out.

---

## 6. Set up webhooks (recommended)

Webhooks make payment state reliable even if the user closes their
browser before client-side verification finishes.

### Local testing

Razorpay can't reach `localhost`. Use a tunnel:

```bash
npx ngrok http 3000          # or `cloudflared tunnel` etc.
```

Copy the HTTPS forwarding URL (e.g. `https://abcd-1234.ngrok.io`).

### Configure in Razorpay dashboard

1. Go to **Account & Settings → Webhooks** →
   <https://dashboard.razorpay.com/app/webhooks>.
2. Click **+ Add new webhook**.
3. Webhook URL: `https://<your-host>/api/razorpay/webhook`
4. **Secret**: paste the same value you put in `RAZORPAY_WEBHOOK_SECRET`.
5. Active events — tick at minimum:
   - `order.paid`
   - `payment.captured`
   - `payment.failed`
   - `refund.created`
   - `refund.processed`
6. Save.

### Verify

Make another test payment. You'll see `200 OK` events in
**Webhooks → Logs**, and a row appears in the `Order` table with
the raw event payload stored in `webhookEvent`.

---

## 7. Going live (production)

1. Complete Razorpay KYC.
2. Switch dashboard to **Live Mode**.
3. Generate **Live API Keys** (`rzp_live_...`).
4. In your hosting provider (e.g. Vercel → Project → Settings → Environment
   Variables), add the **live** keys for the production environment only:
   - `RAZORPAY_KEY_ID` (live)
   - `RAZORPAY_KEY_SECRET` (live)
   - `NEXT_PUBLIC_RAZORPAY_KEY_ID` (live)
   - `RAZORPAY_WEBHOOK_SECRET` (new value for live webhook)
   - `DATABASE_URL` (Postgres in production — see notes below)
5. Add a **second webhook** in the Razorpay dashboard (Live Mode) pointing
   to your production URL.
6. Re-deploy.

> ⚠️ Keep test keys in `Preview` and `Development` Vercel environments,
> live keys only in `Production`. This way preview deploys can't
> accidentally charge real cards.

---

## 8. Production database notes

The dev setup uses SQLite at `file:./dev.db`. **This will not work on
Vercel** because their function filesystem is read-only.

For production, switch to a hosted Postgres:

| Provider          | Free tier       | Best for       |
|-------------------|-----------------|----------------|
| Vercel Postgres   | 60h compute/mo  | Vercel-native  |
| Supabase          | 500 MB DB       | Auth + DB      |
| Neon              | 0.5 GB DB      | Serverless     |
| Railway           | $5 credit / mo  | Simple deploys |

Steps:

```bash
# 1. Update the provider
# in prisma/schema.prisma:
#   datasource db {
#     provider = "postgresql"
#     url      = env("DATABASE_URL")
#   }

# 2. Set DATABASE_URL in Vercel env vars

# 3. Generate fresh migration for Postgres (delete old SQLite migrations
#    if they conflict — orders table will be re-created cleanly)
rm -rf prisma/migrations
npx prisma migrate dev --name init

# 4. Push the new migration
git add prisma && git commit -m "chore: switch to postgres" && git push
```

Vercel's build script already runs `prisma generate && next build`, so
the client gets generated for Postgres automatically on deploy.

---

## 9. Troubleshooting

| Symptom                                              | Fix                                                                  |
|------------------------------------------------------|----------------------------------------------------------------------|
| `Payment gateway not configured` (503)               | Add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` to env, restart dev. |
| Modal opens but says `International cards not allowed`| Use Indian test cards or enable international cards in dashboard.    |
| `Invalid signature — payment verification failed`    | Wrong `RAZORPAY_KEY_SECRET`. Re-copy from dashboard.                 |
| Webhook events show `Failed` in dashboard            | Check `RAZORPAY_WEBHOOK_SECRET` matches dashboard secret exactly.    |
| `Order not found` on /upgrade/success                | DB write failed during `create-order`. Check server logs.            |
| Build error `Module not found: @prisma/client`       | Run `npx prisma generate` (Vercel does this via `postinstall`).      |

---

## 10. Files involved

```
src/
├── lib/
│   └── razorpay.ts                 # Plan prices, GST, server SDK client
└── app/
    ├── api/
    │   └── razorpay/
    │       ├── create-order/route.ts   # POST — create Razorpay order
    │       ├── verify/route.ts         # POST — verify HMAC signature
    │       ├── webhook/route.ts        # POST — async event handler
    │       └── order/[id]/route.ts     # GET  — fetch order details
    └── upgrade/
        ├── page.tsx                # Razorpay checkout opener
        └── success/page.tsx        # Post-payment receipt page

prisma/
├── schema.prisma                   # Order model
└── migrations/
    └── 20260521133000_add_order_table/migration.sql
```
