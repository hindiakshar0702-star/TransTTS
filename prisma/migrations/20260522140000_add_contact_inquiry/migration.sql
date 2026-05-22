-- CreateTable
CREATE TABLE "ContactInquiry" (
    "id" TEXT NOT NULL PRIMARY KEY,

    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT,
    "teamSize" TEXT,
    "message" TEXT NOT NULL,

    "status" TEXT NOT NULL DEFAULT 'new',
    "source" TEXT,

    "ipAddress" TEXT,
    "userAgent" TEXT,
    "referrer" TEXT,

    "notificationEmailSent" BOOLEAN NOT NULL DEFAULT false,
    "autoReplyEmailSent" BOOLEAN NOT NULL DEFAULT false,
    "emailError" TEXT,

    "notes" TEXT,

    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "ContactInquiry_email_idx" ON "ContactInquiry"("email");

-- CreateIndex
CREATE INDEX "ContactInquiry_status_idx" ON "ContactInquiry"("status");

-- CreateIndex
CREATE INDEX "ContactInquiry_createdAt_idx" ON "ContactInquiry"("createdAt");
