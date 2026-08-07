# TransTTS

Speech and language workspace built on Next.js (App Router): **record** audio in
the browser, **transcribe** it with Whisper, **translate** across languages, and
generate natural **text-to-speech**.

## What it does

- **Recorder** — browser capture at 48kHz with a live teleprompter that
  highlights words as you speak, plus optional noise suppression (rnnoise
  worklet, client-side).
- **Transcription** — audio or video to timestamped text via Whisper, with
  automatic language detection across ~99 languages.
- **Social video** — paste a YouTube, Vimeo, X/Twitter, Facebook, Instagram or
  Pinterest link and transcribe its audio, optionally converting the result to
  Hindi. Public content only.
- **Translation** — 25+ languages, cached and split at sentence boundaries.
- **Text-to-speech** — 19 neural voices across Indian and international
  languages.

Long-running work (transcription, synthesis, social downloads) is processed in
the background against a job row the client polls, so no request blocks on it.

## Stack

- **Next.js 16** / **React 19** (App Router, `src/` layout)
- **Prisma** ORM → PostgreSQL
- **Auth.js v5** (`next-auth`): Google OAuth + email/password credentials, JWT
  sessions, user/admin roles
- Transcription: Whisper via **Groq** (free tier) or **OpenAI**
- TTS: **msedge-tts** · Translation: **MyMemory** (free)
- Social video: **yt-dlp** · Noise cleanup: DeepFilterNet (optional, Python)

## Project layout

```
src/
  auth.ts           Auth.js providers (Google + Credentials) — node only
  auth.config.ts    edge-safe config: session strategy, route protection
  proxy.ts          Auth.js middleware gating the signed-in app routes
  app/
    api/auth/       [...nextauth], register, logout, logout-all, me,
                    change-password, request-reset, reset-password, otp/*
    api/            transcribe, social-transcribe, translate, tts,
                    tts/audio/[id], jobs, jobs/[id], profile, contact,
                    clean-audio, health
    (pages)         landing, about, contact, privacy-policy,
                    terms-and-conditions, login, verify, forgot/reset-password,
                    dashboard, record, transcribe, translate, tts, settings,
                    profile
  components/       UI + landing/*
  lib/              auth, prisma, api-guard, transcription, translate, tts,
                    videoDownload, socialPlatforms, teleprompterMatch,
                    media-cleanup, otp, mail, sms, seo, …
prisma/             schema.prisma + migrations
tests/              Playwright: e2e, a11y, and pure-logic suites
docs/               DEPLOYMENT.md
```

`generated/` (TTS output) and `uploads/` (transient) are runtime dirs, gitignored
and swept automatically — see [Media cleanup](#media-cleanup).

## Setup

1. `npm install --legacy-peer-deps`

   `next-auth` v5 declares an optional `nodemailer` peer that conflicts with the
   pinned version. The Email provider is unused, so the flag is expected.

2. Copy `.env.example` to `.env.local` and fill it in. The minimum to boot:

   ```bash
   DATABASE_URL=          # Postgres (pooled)
   DIRECT_URL=            # Postgres (direct — used for migrations)
   AUTH_SECRET=           # >=32 chars: openssl rand -base64 48
   AUTH_URL=http://localhost:3000
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   GROQ_API_KEY=          # or OPENAI_API_KEY — without one, transcription errors
   ```

   `.env.example` documents every variable and what breaks when it is missing.

3. `npx prisma migrate dev`
4. `npm run dev` → http://localhost:3000

### Google sign-in

Set either naming — `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` (Auth.js convention,
takes precedence) or `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

In the Google Cloud OAuth client (type: **Web application**), register the
redirect URI:

```
http://localhost:3000/api/auth/callback/google
```

Add the production origin's equivalent before deploying. A missing or mismatched
entry fails with `redirect_uri_mismatch`.

### Social video transcription

Requires `yt-dlp` on `PATH`, or `YT_DLP_PATH` pointing at the binary. The Docker
image installs it. Only publicly accessible media is attempted — no credentials
or cookies are sent, so private and DRM-protected videos fail with a clear
message.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | dev server |
| `npm run build` / `start` | production build / serve |
| `npm run lint` | ESLint |
| `npm run test:e2e` | full Playwright suite |
| `npm run test:a11y` | accessibility audit |
| `npm run test:links` | link checker |
| `npm run test:all` | lint + full suite |

## Testing

Playwright covers end-to-end flows, accessibility (WCAG AA via axe), responsive
behaviour across three viewports, and pure logic — teleprompter word matching,
translation chunking, cache keys and media cleanup.

Suites that need an authenticated page use `tests/helpers/auth.ts`, which
registers a throwaway user and signs in through the Auth.js credentials flow.
`OTP_TEST_MODE=1` lets the OTP suite read codes back without a mail or SMS
provider; it must stay unset in production.

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). In short: TransTTS needs a
**long-running Node process** — Render, Railway, Fly, or a VPS. It does not work
on serverless platforms, because it continues processing after the response
returns, writes uploads to disk, and spawns `yt-dlp` as a child process.

A `Dockerfile` and a `render.yaml` blueprint are included. The container
entrypoint applies migrations before serving, and `GET /api/health` reports `ok`
only when the database answers.

## Media cleanup

Generated audio and uploads are swept automatically. Uploads are scratch and are
dropped an hour after their request dies; generated TTS audio is user-facing and
kept for `MEDIA_TTL_DAYS` (default 7), after which the file is removed and the
owning job's audio link is cleared in the same pass. The sweep is triggered
opportunistically by the transcribe and TTS routes and throttles itself to once
an hour, so it needs no scheduler.

## Caching

Translation results are cached in a shared table keyed by a hash of the text and
language pair — only the hash and the result are stored, never the source text.
Speech is cached per user against a hash of text, voice and rate, so an identical
repeat request returns the existing audio instead of paying for synthesis again.

## Security

Public, file-handling service — see [CLAUDE.md](CLAUDE.md) for the principles.
In practice: uploads are validated by magic number rather than the declared
content type, every filesystem path is normalised and prefix-checked, external
processes are spawned with argument arrays and no shell, mutating routes are
rate-limited and same-origin checked, and jobs and audio are scoped to their
owner. Passwords use scrypt with constant-time comparison, and bumping a user's
token version revokes every existing session.

Rate limiting is in-memory and therefore per-instance; running more than one
container needs a shared store to be meaningful.
