# Contact Form Setup & Testing

The `/contact` form (Send Us a Message) is live and **persists every
submission to the database**, even when no email service is configured.
This guide covers turning on email notifications and verifying the
end-to-end flow.

---

## TL;DR

| Want it to… | Set these env vars |
|---|---|
| Save submissions to DB only (no email) | _nothing — works out of the box_ |
| Email you on every new submission + auto-reply to the user | `RESEND_API_KEY`, `ADMIN_EMAIL`, `FROM_EMAIL` |
| Inspect submissions over HTTP | `ADMIN_TOKEN` |

---

## 1. Run the migration

The form writes to a new `ContactInquiry` table.

```bash
npm install                # postinstall runs prisma generate
npx prisma migrate dev     # applies 20260522140000_add_contact_inquiry
```

If you've switched to Postgres (see `RAZORPAY_SETUP.md` § 8), Prisma
will run the same SQL against Postgres — no edits needed.

---

## 2. (Optional) Enable email via Resend

### a. Sign up

1. Go to <https://resend.com/signup> and create a free account
   (3,000 emails / month, plenty for any contact form).
2. **API Keys → Create API Key**, copy the value (starts with `re_`).

### b. Pick a sender address

You have two options:

| Option | Example `FROM_EMAIL` | Pros | Cons |
|---|---|---|---|
| **Resend test sender** | `onboarding@resend.dev` | Works in 60 seconds, no DNS | Can only send to the email you signed up with |
| **Your own domain** | `TransTTS AI <hello@your-domain.com>` | Looks professional, sends to anyone | Needs DNS records (SPF, DKIM) — Resend walks you through it |

For first-time testing the Resend sender is fine. For production you
will want your own domain.

### c. Fill in the env vars

In `.env.local`:

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
ADMIN_EMAIL=hello@your-domain.com         # Where new submissions get sent
FROM_EMAIL=TransTTS AI <onboarding@resend.dev>
```

For Vercel: **Project → Settings → Environment Variables**, add all
three to the **Production** scope (and Preview if you want emails to
fire on PR previews too).

---

## 3. (Optional) Enable the admin list endpoint

There is a tiny `GET /api/contact` route that returns the latest
submissions as JSON. It refuses to serve anything until `ADMIN_TOKEN`
is set, so it's safe to leave it deployed.

```bash
ADMIN_TOKEN=$(openssl rand -hex 32)         # any long random string
```

Use it like:

```bash
curl "https://your-domain.com/api/contact?token=$ADMIN_TOKEN&limit=20"
```

Or the equivalent header form for cleaner request logs:

```bash
curl https://your-domain.com/api/contact -H "X-Admin-Token: $ADMIN_TOKEN"
```

Returns the most recent inquiries (default 50, max 200) including
`notificationEmailSent` flags so you can spot delivery failures.

---

## 4. Test the form end-to-end

### Local

```bash
npm run dev
# open http://localhost:3000/contact
```

1. Fill in name, email, a 10+ char message, hit **Send Message**.
2. You should see the green ✅ "Thank You!" page.
3. Verify a row in DB:

   ```bash
   npx prisma studio
   # → ContactInquiry table → newest row at the top
   ```

   Expected fields populated: `name`, `email`, `message`, `ipAddress`,
   `userAgent`, `referrer`, `status="new"`, `source="contact_page"`.

4. If `RESEND_API_KEY` is set:
   - Check `ADMIN_EMAIL` inbox → 📬 *New contact: …* email arrives.
   - Check the inquirer's email inbox → 👋 auto-reply arrives.
   - In Studio, `notificationEmailSent` flips to `true`.

### Production (Vercel)

Same steps against your production URL. If emails don't arrive:

1. Open **Resend → Logs** — every send (success or failure) is recorded.
2. Check the row's `emailError` column in the DB.
3. Most common cause: `FROM_EMAIL` uses a domain that isn't verified
   in Resend yet.

### Admin endpoint smoke test

```bash
curl "https://your-domain.com/api/contact?token=$ADMIN_TOKEN&limit=5" | jq
```

Should return `{ "count": <n>, "items": [ ... ] }`.

---

## 5. What's protecting the form?

| Layer | What it does |
|---|---|
| **Client validation** | Required fields, email regex, min message length |
| **Server validation** | Same checks again — never trust the client |
| **Honeypot** | Invisible `website` input — bots fill it, humans don't. Submissions with it set return `200` silently and aren't saved. |
| **Rate limit** | 5 submissions per IP per 15 minutes (in-memory). 429 with `Retry-After` header when exceeded. |
| **Length caps** | Name 120, email 200, company 200, message 4,000 chars. Prevents stuffing huge payloads. |
| **Source-of-truth ordering** | DB write happens **before** any email send. Email failures never lose a lead. |

For higher traffic, swap `src/lib/rate-limit.ts` to use
[Upstash](https://upstash.com) or [Vercel KV](https://vercel.com/docs/storage/vercel-kv)
— the function signature is unchanged.

---

## 6. Troubleshooting

| Symptom | Fix |
|---|---|
| Form shows ✅ but no email arrives | Check `RESEND_API_KEY`, `FROM_EMAIL`, `ADMIN_EMAIL` are all set. Restart `npm run dev` after editing `.env.local` (vars are read at boot). |
| Resend log says `from address not verified` | Either use `onboarding@resend.dev` for testing, or finish DNS verification for your custom domain in the Resend dashboard. |
| `Too many requests` 429 in production | Expected — bumping the limit means editing `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_MS` at the top of `src/app/api/contact/route.ts`. |
| Honeypot still gets spam through | Add a real CAPTCHA (Turnstile / hCaptcha) — requires one extra env var and a `<script>` tag. Easy upgrade if abuse becomes real. |
| Need to migrate old leads | They are all in `ContactInquiry`. `prisma.contactInquiry.findMany({ orderBy: { createdAt: 'desc' } })` and pipe into your CRM. |

---

## 7. Files involved

```
prisma/
├── schema.prisma                                    # ContactInquiry model
└── migrations/20260522140000_add_contact_inquiry/   # SQL

src/
├── lib/
│   ├── email.ts             # Resend REST client + HTML helpers
│   └── rate-limit.ts        # In-memory IP rate limiter
└── app/
    ├── api/contact/route.ts # POST submit + GET admin list
    └── contact/page.tsx     # Real fetch, loading, errors, honeypot
```
