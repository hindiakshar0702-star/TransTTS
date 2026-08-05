# Deploying TransTTS

## What the app needs from a host

TransTTS does not run correctly on serverless platforms (Vercel, Netlify
Functions, Cloudflare Workers). Four things it does are incompatible with a
function that is frozen once it returns a response:

| Requirement | Where it comes from |
| --- | --- |
| Work continues after the response | Transcription is kicked off in the background and the client polls `/api/jobs/:id`. A frozen function leaves jobs stuck at "processing". |
| A writable filesystem | Uploads are written to `uploads/`, generated speech to `generated/`. |
| Child processes | Social-video transcription spawns `yt-dlp`. |
| Long execution | A Whisper call on a 25MB file can exceed serverless time limits. |

So: any host that runs a **long-lived container or Node process**. Render,
Railway, Fly.io, or a plain VPS all work. The repo ships a `Dockerfile` and a
`render.yaml` blueprint.

## Option A — Render (blueprint included)

1. Push this branch to GitHub.
2. Render dashboard → **New +** → **Blueprint** → pick the repo.
   `render.yaml` provisions the web service and a Postgres instance, generates
   `AUTH_SECRET`, wires `DATABASE_URL`, and mounts a 1GB disk at
   `/app/generated`.
3. Fill in the secrets it marks as required: `GOOGLE_CLIENT_ID`,
   `GOOGLE_CLIENT_SECRET`, and `GROQ_API_KEY` (or `OPENAI_API_KEY`).
4. Deploy. The entrypoint runs `prisma migrate deploy` before the server starts.

Note the `plan:` values. The free Postgres tier expires after 30 days, and a
free web service has no persistent disk — generated audio would disappear on
each redeploy.

## Option B — Docker anywhere

```bash
docker build --build-arg NEXT_PUBLIC_APP_URL=https://your-domain.com -t transtts .

docker run -d -p 3000:3000 \
  --env-file .env.production \
  -v transtts-media:/app/generated \
  transtts
```

`NEXT_PUBLIC_APP_URL` is inlined at build time, so it must be passed as a build
argument — setting it only at runtime leaves the client-side code pointing at
the wrong origin.

The image installs `yt-dlp` and `ffmpeg`, so social-video transcription works
out of the box.

## Option C — VPS without Docker

```bash
npm ci --legacy-peer-deps
npx prisma generate
npx prisma migrate deploy
npm run build
npm start          # or run under pm2 / systemd
```

Install `yt-dlp` and `ffmpeg` separately, and put nginx or Caddy in front for
TLS.

## Environment variables

`.env.example` is the full list with notes. The ones that block startup or
silently break features:

| Variable | Consequence if missing |
| --- | --- |
| `DATABASE_URL`, `DIRECT_URL` | Container refuses to start. |
| `AUTH_SECRET` (≥32 chars) | Every auth request fails. |
| `AUTH_URL`, `NEXT_PUBLIC_APP_URL` | OAuth callbacks, canonical URLs and the sitemap point at the wrong origin. |
| `GROQ_API_KEY` or `OPENAI_API_KEY` | Transcription returns an error. |
| `GOOGLE_CLIENT_ID` / `_SECRET` | Google sign-in unavailable (email/password still works). |
| SMTP or `RESEND_API_KEY` | OTP codes, password resets and contact messages are only written to the log — users never receive them. |

`OTP_TEST_MODE` must stay **unset** in production. It exposes a route that
reads back OTP codes; the route 404s without it, but do not set it.

## After the first deploy

1. **Google OAuth** — in Google Cloud Console, add
   `https://your-domain.com/api/auth/callback/google` to the OAuth client's
   authorised redirect URIs. Without it, Google sign-in fails with
   `redirect_uri_mismatch`.
2. **Rotate `AUTH_SECRET`** if the development value was ever reused. Rotating
   it signs everyone out, which is the intended effect.
3. **Health check** — `GET /api/health` returns `200 {"status":"ok"}` only when
   the database answers, and `503` otherwise.
4. **Search Console** — verify the domain, put the token in
   `GOOGLE_SITE_VERIFICATION`, redeploy, then submit
   `https://your-domain.com/sitemap.xml`. Indexing typically takes one to four
   weeks.

## Continuous integration

`.github/workflows/ci.yml` runs on every push to `main` and on pull requests:
lint, typecheck, build, and the Playwright suite against a throwaway Postgres
service. It does not deploy — Render's `autoDeploy` handles that on push.

## Operational notes

- **Rate limiting is per-instance.** `lib/api-guard.ts` keeps counters in
  memory, so limits are enforced per container and reset on restart. Running
  more than one instance needs a shared store (Redis) to be meaningful.
- **`uploads/` is scratch.** Files are deleted once transcribed; it does not
  need a volume. `generated/` does — TTS clips are served back to users later.
- **Downloading from some platforms** (Instagram, Facebook, Pinterest, X) may
  breach their terms of service. Only publicly accessible media is attempted,
  and no credentials or cookies are sent.
