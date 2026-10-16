"use client";
import { useState } from "react";
import { AuthForm } from "./auth-form";
export function ShillatakJoinAuth({ code }: { code: string }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  return <section data-testid="shillatak-join-auth">
    <p className="shell form-note">سجّل الدخول أو أنشئ حسابًا للعودة إلى هذه الدعوة. لن تُقبل العضوية تلقائيًا.</p>
    <AuthForm key={mode} mode={mode} returnTo={`/shillatak/join/${code}`} onModeChange={setMode} />
  </section>;
}
