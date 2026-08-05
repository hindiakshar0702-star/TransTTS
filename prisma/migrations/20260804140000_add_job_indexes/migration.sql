-- Speeds up the jobs list/dashboard queries: filter by owner (+ optional type),
-- newest first. Previously applied to dev via `prisma db push`; captured here so
-- `prisma migrate deploy` reproduces it on a fresh/production database.
CREATE INDEX IF NOT EXISTS "Job_userId_createdAt_idx" ON "Job"("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Job_userId_type_idx" ON "Job"("userId", "type");
