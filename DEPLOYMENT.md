# Deploying TransTTS to Production

This document covers the **non-code** changes required to take TransTTS
from local SQLite to a real production deployment on Vercel.

> The repository's source is already production-grade after PRs #3-#7.
> This guide is what the operator must do **on the dashboard side** —
> change a database, set environment variables, and verify endpoints.

---

## 1. Switch the database to Postgres (CRITICAL — BUG-001)

SQLite cannot be used on Vercel. Each function instance has its own
ephemeral file system, so:

- Two parallel requests see two different databases.
- Every cold start serves an empty database.
- Every deploy wipes all data.

### One-time setup

1. Provision a Postgres database. Recommended providers:
   - **Vercel Postgres** (zero-config, integrated with Vercel)
   - **Neon** (free tier, serverless-friendly with `?pgbouncer=true`)
   - **Supabase** (free tier, also includes auth/storage if you need it later)

2. Update `prisma/schema.prisma` — change the datasource provider:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

3. In your local `.env.local`, point `DATABASE_URL` at the Postgres
   connection string. Use the **pooled** connection string in production
   (Vercel functions are short-lived so a connection pool with
   `connection_limit=1` is enough):

   ```env
   # Vercel Postgres (auto-set by integration)
   DATABASE_URL="postgres://default:...@...neon.tech/neondb?sslmode=require&pgbouncer=true&connection_limit=1"
   ```

4. Re-create the migration history for Postgres:
   ```bash
   rm -rf prisma/migrations
   npx prisma migrate dev --name init
   ```

5. In Vercel → **Project Settings → Environment Variables**, add
   `DATABASE_URL` for **Production** and **Preview** environments.

6. Optionally enable Vercel's Postgres integration to auto-inject
   the variables for you.

### Verifying

After deploy, hit `https://<your-domain>/api/jobs` — should return
an empty array (`[]`), not 500.

---

## 2. Configure required environment variables

Copy `.env.example` for the full list. The minimum required for
production:

| Variable | Required for | Notes |
|---|---|---|
| `DATABASE_URL` | Everything | Postgres pooled connection string. |
| `NEXT_PUBLIC_APP_URL` | PhonePe redirects, email links | Must be the absolute production URL with `https://`. |
| `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` | Razorpay checkout | Live keys from Razorpay dashboard, NOT test keys. |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Razorpay frontend | Same value as `RAZORPAY_KEY_ID`. |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook signature | Must match the value set when creating the webhook in the Razorpay dashboard. |
| `PHONEPE_MERCHANT_ID`, `PHONEPE_SALT_KEY`, `PHONEPE_SALT_INDEX` | PhonePe checkout | Empty/leave unset to use sandbox. |
| `PHONEPE_ENV` | PhonePe environment | `UAT` for sandbox, `PROD` for live. |
| `GROQ_API_KEY` | `/transcribe` | Free tier OK. |
| `ADMIN_TOKEN` | Destructive endpoints | **Generate with `openssl rand -hex 32`**. Without it, dashboard delete buttons return 503. |
| `RESEND_API_KEY`, `ADMIN_EMAIL`, `FROM_EMAIL` | Contact form notifications | Or use `NEXT_PUBLIC_FORMSUBMIT_EMAIL` instead. |

---

## 3. Configure Razorpay webhook

Go to Razorpay Dashboard → **Webhooks** → **Add new webhook**:

- **Webhook URL:** `https://<your-domain>/api/razorpay/webhook`
- **Active events:**
  - `payment.captured`
  - `payment.failed`
  - `refund.created`
- **Secret:** any long random string. Save the SAME value as
  `RAZORPAY_WEBHOOK_SECRET` in Vercel env vars.

After saving, click **"Send test event"** — should land in your DB
within ~5 seconds (verify by hitting `/api/orders/<id>` via GET).

---

## 4. Configure PhonePe webhook

PhonePe Business Dashboard → **Developer Settings → Webhooks**:

- **Webhook URL:** `https://<your-domain>/api/phonepe/webhook`
- The webhook signature uses the same `PHONEPE_SALT_KEY` /
  `PHONEPE_SALT_INDEX` env vars; no separate webhook secret needed.

---

## 5. Disable Vercel Deployment Protection for previews (optional)

By default Vercel preview URLs require login. To allow QA / public
preview testing:

**Project Settings → Deployment Protection → Vercel Authentication
→ "Only Production Deployments"**.

Production URL stays protected; previews become publicly accessible.

---

## 6. Generate `ADMIN_TOKEN` and seed the dashboard

Required for the destructive endpoints introduced by PR #3:

```bash
openssl rand -hex 32
# 64 char hex string — paste into Vercel env vars as ADMIN_TOKEN
```

After redeploy, open `/dashboard` and click any "🗑 Delete" button —
the operator will be prompted once for the token. It's stored in the
admin's `localStorage` and sent as `Authorization: Bearer …` on every
destructive call.

---

## 7. Health check

After all of the above, verify by hand:

1. **Home page** loads at the production URL.
2. **TTS:** generate a short clip → audio plays inline. Reload the
   page, hit Play in the dashboard → audio still plays (regenerate-on-demand).
3. **Translate:** paste 8000-char Hindi → English. Should chunk
   transparently and finish in ~10s.
4. **Razorpay:** start checkout, complete with test card
   (`4111 1111 1111 1111`). Verify the order moves to `paid` and the
   amount on the receipt matches the upgrade page summary to the paisa.
5. **PhonePe:** start UAT checkout, complete. Order moves to `paid`
   (or `pending` followed by `paid` once webhook fires).
6. **Security headers:** run `curl -I https://<your-domain>/` and
   confirm `Content-Security-Policy`, `Strict-Transport-Security`,
   etc. are present.
7. **Lighthouse:** Accessibility ≥ 95, Best Practices ≥ 95.

---

## Future hardening (not in this audit's scope)

- Replace per-instance rate limiter with **Upstash Redis** /
  **Vercel KV** so it's actually effective across the auto-scaled
  function fleet.
- Move `/api/transcribe` upload to **Vercel Blob** so we don't write
  potentially-large user files to `/tmp`.
- Add **Sentry** (or similar) for production error tracking.
- Add **GitHub Actions CI** running `tsc --noEmit` and `next lint`
  on every PR (configuration was made strict in this PR — see
  `next.config.ts`).
