-- Google is now the only sign-in method, so the app stores no credentials.
-- Dropping the column removes the stored hashes with it.
ALTER TABLE "User" DROP COLUMN IF EXISTS "passwordHash";

-- Password reset only existed to recover a local password.
DROP TABLE IF EXISTS "PasswordResetToken";

-- Accounts are created through Google from here on.
ALTER TABLE "User" ALTER COLUMN "provider" SET DEFAULT 'google';
