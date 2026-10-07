"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Account = { id: string; name: string; email: string; role: "USER" | "ADMIN"; suspended: boolean; createdAt: string; balance: number; games: number };
export function UserManager({ users, ownId }: { users: Account[]; ownId: string }) {
  const router = useRouter(); const [busy, setBusy] = useState(""); const [error, setError] = useState("");
  async function change(user: Account, input: { role: "USER" | "ADMIN" } | { suspended: boolean }) {
    if (user.id === ownId) return;
    const action = "role" in input ? input.role === "ADMIN" ? "ترقية هذا الحساب إلى مسؤول؟" : "إزالة صلاحية المسؤول؟" : input.suspended ? "إيقاف الحساب ومنع الدخول؟" : "إعادة تفعيل الحساب؟";
    if (!window.confirm(action)) return;
    setBusy(user.id); setError("");
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "تعذّر حفظ الحساب");
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر حفظ الحساب"); }
    finally { setBusy(""); }
  }
  return <div className="item-list">{error && <p className="form-error" role="alert">{error}</p>}{users.map(user => <article className="item" key={user.id}><div><h3>{user.name}</h3><p dir="ltr">{user.email}</p><p>{user.role === "ADMIN" ? "مسؤول" : "مستخدم"} · {user.suspended ? "موقوف" : "نشط"} · {user.balance} ألعاب · {user.games} مباريات</p></div><div className="item-actions">{user.id === ownId ? <span className="badge">حسابك</span> : <><button className="btn btn-secondary btn-small" disabled={Boolean(busy)} onClick={() => change(user, { role: user.role === "ADMIN" ? "USER" : "ADMIN" })}>{user.role === "ADMIN" ? "إزالة المسؤول" : "ترقية لمسؤول"}</button><button className={user.suspended ? "btn btn-secondary btn-small" : "btn btn-danger btn-small"} disabled={Boolean(busy)} onClick={() => change(user, { suspended: !user.suspended })}>{user.suspended ? "إعادة تفعيل" : "إيقاف"}</button></>}</div></article>)}{users.length === 0 && <div className="empty">لا توجد حسابات تطابق البحث.</div>}</div>;
}
