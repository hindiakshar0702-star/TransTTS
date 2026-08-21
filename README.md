# TransTTS

A free speech and language workspace built on Next.js (App Router): **record**
audio in the browser, **transcribe** it with Whisper, **translate** across
languages, and generate natural **text-to-speech**.

No account, no database, no cost to run — this variant is designed to deploy on
a free serverless tier (Vercel).

## What it does

- **Recorder** — browser capture with a live teleprompter that highlights words
  as you speak, plus optional noise suppression (rnnoise worklet, client-side).
- **Transcription** — audio or video to timestamped text via Whisper, with
  automatic language detection across ~99 languages.
- **Translation** — 25+ languages, split at sentence boundaries.
- **Text-to-speech** — 19 neural voices across Indian and international
  languages, returned inline and playable/downloadable in the browser.

Everything runs synchronously in a single request — no background jobs, no
writable disk — so it fits serverless free tiers. History is kept in the
browser (localStorage); nothing is stored server-side.

## Stack

- **Next.js 16** / **React 19** (App Router, `src/` layout)
- Transcription: Whisper via **Groq** (free tier) or **OpenAI**
- TTS: **msedge-tts** (Microsoft Edge neural voices — free, no key)
- Translation: **Groq** LLM (`openai/gpt-oss-120b`, free tier — same key as
  transcription)

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and set a Groq key:

   ```bash
   GROQ_API_KEY=          # free at console.groq.com
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

3. `npm run dev` → http://localhost:3000

`.env.example` documents every variable. `GROQ_API_KEY` drives both
transcription and translation; `OPENAI_API_KEY` is an alternative for
transcription only. TTS needs no key.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | dev server |
| `npm run build` / `start` | production build / serve |
| `npm run lint` | ESLint |
| `npm run test:e2e` | full Playwright suite |
| `npm run test:a11y` | accessibility audit |

## Deployment

Deploys to **Vercel** (or any Node host) for free, with no card:

1. Push to GitHub and import the repo at [vercel.com/new](https://vercel.com/new).
2. Set `GROQ_API_KEY` and `NEXT_PUBLIC_APP_URL` (your `https://<project>.vercel.app`)
   in the project's Environment Variables.
3. Deploy.

The API routes run as serverless functions. TTS writes to the platform temp dir
(`/tmp`) within the request and returns the audio inline, so no persistent disk
is needed.

## Notes

- A single request may carry 4MB — not Whisper's 25MB limit but the host's:
  Vercel rejects a serverless request body over ~4.5MB at the edge, before any
  code runs. Bigger files are split in the browser and sent as several
  uploads, up to 10, so about 40MB of MP3 in practice. MP3 is cut on frame
  boundaries (lossless, no decode); anything else is decoded to 16kHz mono WAV
  and cut by time. `NEXT_PUBLIC_MAX_UPLOAD_MB` raises the per-request size on
  hosts without the edge limit.
- TTS is capped at 5000 characters.
- Rate limiting is in-memory and per-instance — fine for a single serverless
  deployment, best-effort under scale.
