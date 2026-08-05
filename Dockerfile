# TransTTS production image.
#
# Multi-stage: dependencies and the Next build happen in throwaway stages, and
# only the standalone server bundle reaches the final image. The runtime stage
# additionally carries yt-dlp and ffmpeg, which the social-video transcription
# route shells out to.
#
# Build:  docker build -t transtts .
# Run:    docker run -p 3000:3000 --env-file .env.production transtts

# ---------- deps ----------
FROM node:22-alpine AS deps
WORKDIR /app

# Prisma's query engine needs OpenSSL; libc6-compat covers glibc-built binaries.
RUN apk add --no-cache libc6-compat openssl

COPY package.json package-lock.json ./
COPY prisma ./prisma
# next-auth v5 declares an optional nodemailer peer that conflicts with the
# version this project pins; the Email provider is unused, so resolve loosely.
RUN npm ci --legacy-peer-deps

# ---------- build ----------
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Client-side values are inlined at build time, so the public origin must be
# known here — not just at runtime. Everything else is read at runtime.
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

# A dummy value satisfies imports that construct clients at module scope; the
# real secrets are injected when the container runs.
ENV AUTH_SECRET="build-time-placeholder-not-used-at-runtime-000000"
ENV NEXT_TELEMETRY_DISABLED=1

RUN npx prisma generate
RUN npm run build

# ---------- runtime ----------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# yt-dlp downloads social-video audio; ffmpeg is what it uses to remux or merge
# streams when a platform does not expose a single ready-made audio file.
# openssl is required by the Prisma query engine at runtime.
#
# yt-dlp comes from pip rather than apk deliberately: sites change their players
# often and the distro package lags months behind, which shows up as extraction
# failures. Rebuilding the image picks up the current release. --break-system-
# packages is required because Alpine marks its Python install as externally
# managed (PEP 668); there is no other Python application in this image.
RUN apk add --no-cache libc6-compat openssl ffmpeg python3 py3-pip \
    && pip3 install --no-cache-dir --break-system-packages yt-dlp \
    && addgroup -g 1001 -S nodejs \
    && adduser -u 1001 -S nextjs -G nodejs

# Standalone output already includes the traced node_modules.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Prisma CLI + schema so the entrypoint can apply migrations on boot.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin ./node_modules/.bin

# uploads/ is scratch space (files are deleted once transcribed); generated/
# holds TTS audio that is served back later, so mount a volume there in
# production or generated clips vanish on redeploy.
RUN mkdir -p uploads generated && chown -R nextjs:nodejs uploads generated

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER nextjs
EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
