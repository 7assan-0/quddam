"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return <button className="btn btn-secondary btn-small" disabled={busy} onClick={async () => {
    setBusy(true);
    try { const response = await fetch("/api/auth/logout", { method: "POST" }); if (!response.ok) throw new Error(); router.push("/"); router.refresh(); }
    catch { setBusy(false); alert("تعذّر تسجيل الخروج. حاول مرة أخرى."); }
  }}>{busy ? "لحظة..." : "خروج"}</button>;
}
