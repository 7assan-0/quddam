ALTER TABLE "CreditWallet"
ADD CONSTRAINT "CreditWallet_balance_nonnegative" CHECK ("balance" >= 0);
