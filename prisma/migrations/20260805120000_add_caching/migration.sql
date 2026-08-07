-- TTS reuse: a hash of (text + voice + rate) on the job that produced the audio.
ALTER TABLE "Job" ADD COLUMN "cacheKey" TEXT;

-- Cache lookup is always scoped to one user, so audio is never shared between
-- accounts and clearing one history cannot orphan another's player.
CREATE INDEX IF NOT EXISTS "Job_userId_cacheKey_idx" ON "Job"("userId", "cacheKey");

-- The cleanup sweep and the audio route both resolve a job from its audioUrl.
CREATE INDEX IF NOT EXISTS "Job_audioUrl_idx" ON "Job"("audioUrl");

-- Translation results keyed by a hash of (text + source + target). Only the
-- hash and the result are stored — never the source text.
CREATE TABLE "TranslationCache" (
    "key" TEXT NOT NULL,
    "translatedText" TEXT NOT NULL,
    "engine" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hitCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TranslationCache_pkey" PRIMARY KEY ("key")
);

CREATE INDEX IF NOT EXISTS "TranslationCache_lastUsedAt_idx" ON "TranslationCache"("lastUsedAt");
