-- Make razorpayOrderId nullable + add provider/phonepe columns.
-- SQLite does not support DROP/ALTER COLUMN, so the table is recreated.

PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL DEFAULT 'razorpay',

    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "razorpaySignature" TEXT,

    "phonepeMerchantTransactionId" TEXT,
    "phonepeTransactionId" TEXT,
    "phonepeProviderReferenceId" TEXT,

    "plan" TEXT NOT NULL,
    "cycle" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'created',

    "userEmail" TEXT,
    "userName" TEXT,
    "userPhone" TEXT,

    "validUntil" DATETIME,
    "webhookEvent" TEXT,
    "errorMsg" TEXT,

    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "new_Order" (
    "id", "razorpayOrderId", "razorpayPaymentId", "razorpaySignature",
    "plan", "cycle", "amount", "currency", "status",
    "userEmail", "userName",
    "validUntil", "webhookEvent", "errorMsg", "createdAt", "updatedAt"
)
SELECT
    "id", "razorpayOrderId", "razorpayPaymentId", "razorpaySignature",
    "plan", "cycle", "amount", "currency", "status",
    "userEmail", "userName",
    "validUntil", "webhookEvent", "errorMsg", "createdAt", "updatedAt"
FROM "Order";

DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";

CREATE UNIQUE INDEX "Order_razorpayOrderId_key"
    ON "Order"("razorpayOrderId");
CREATE UNIQUE INDEX "Order_phonepeMerchantTransactionId_key"
    ON "Order"("phonepeMerchantTransactionId");

CREATE INDEX "Order_userEmail_idx" ON "Order"("userEmail");
CREATE INDEX "Order_status_idx"    ON "Order"("status");
CREATE INDEX "Order_provider_idx"  ON "Order"("provider");

PRAGMA foreign_keys=ON;
