-- M05 only: bounded age-based cleanup of pseudonymous authentication counters.
CREATE INDEX "AuthAttempt_windowStart_idx" ON "AuthAttempt"("windowStart");
