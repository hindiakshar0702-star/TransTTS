# TransTTS

Speech toolkit built on Next.js (App Router): **transcribe** audio to text,
**translate** across 25+ languages, and generate natural **text-to-speech**.

## Stack

- **Next.js 16** / **React 19** (App Router, `src/` layout)
- **Prisma** ORM → PostgreSQL (Supabase)
- Hand-rolled auth: scrypt password hashing + `jose` JWT session cookies + Google OAuth
- Transcription: Whisper via **Groq** (free) or **OpenAI**
- TTS: **msedge-tts** · Translation: **MyMemory** (free) · Noise cleanup: DeepFilterNet (optional Python)

## Project layout

```
src/
  app/            routes (pages + /api/*)
    api/auth/     register, login, logout, me, google, google/callback
    api/          transcribe, translate, tts, tts/audio/[id], jobs, jobs/[id], clean-audio
  components/     UI (Icons.tsx, Sidebar, Navbar, landing/*)
  lib/            auth.ts, jwt.ts, prisma.ts, api-guard.ts, useSession.ts, utils.ts
  middleware.ts   session gate for app routes
prisma/           schema.prisma + migrations
public/           served static assets (flags/, avatar/, logos, worklets/)
scripts/          check-links.js
tests/            Playwright e2e + a11y
```

`generated/` (TTS output) and `uploads/` (transient) are runtime dirs — gitignored.

## Setup

1. Install: `npm install`
2. Create `.env.local` with:

   ```bash
   DATABASE_URL=            # Supabase Postgres (pooled)
   DIRECT_URL=             # Supabase Postgres (direct, for migrations)
   AUTH_SECRET=            # >=32 chars — node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   GROQ_API_KEY=           # or OPENAI_API_KEY
   GOOGLE_CLIENT_ID=       # optional — enables Google login
   GOOGLE_CLIENT_SECRET=
   NEXT_PUBLIC_APP_URL=    # e.g. http://localhost:3000
   ```

3. Apply schema: `npx prisma migrate dev`
4. Run: `npm run dev` → http://localhost:3000

Google OAuth: register the callback `http://localhost:3000/api/auth/google/callback`
in the Google Cloud OAuth client.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | dev server |
| `npm run build` / `start` | production build / serve |
| `npm run lint` | ESLint |
| `npm run test:e2e` | Playwright e2e |
| `npm run test:a11y` | accessibility audit |
| `npm run test:links` | link checker |

## Security

Public, file-handling service — see [CLAUDE.md](CLAUDE.md) for the security
principles (upload validation, path-traversal defense, rate limiting, per-user
data isolation). App routes require a session; jobs are scoped to their owner.
