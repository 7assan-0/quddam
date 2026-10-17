import { formatNumber } from "@/lib/format-number";
import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@/lib/auth/session";
import { LogoutButton } from "@/components/logout-button";
import { Brand } from "@/components/brand";
import { walletForAccount } from "@/lib/billing/credits";
import "../styles/tokens.css";
import "./globals.css";
import "../styles/components.css";
import "../styles/quddam.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: { default: "قدّام | اللعب يبدأ من هنا", template: "%s | قدّام" }, applicationName: "قدّام",
  description: "ألعاب جماعية عربية لجمعة الأهل والأصحاب. اختاروا لعبتكم، جهّزوا الفريقين، ويلا قدّام.",
  openGraph: { title: "قدّام | اللعب يبدأ من هنا", description: "ألعاب وتحديات تجمعكم، من الجوال إلى شاشة المجلس.", locale: "ar_SA", type: "website", siteName: "قدّام" },
  twitter: { card: "summary_large_image", title: "قدّام | اللعب يبدأ من هنا", description: "ألعاب وتحديات لجمعة الأهل والأصحاب." },
};
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  let user: Awaited<ReturnType<typeof currentUser>> = null;
  try { user = await currentUser(); } catch { /* Public pages remain readable before database setup. */ }
  // Show the authoritative wallet balance, including first-time welcome entitlement.
  // A failed wallet read must never masquerade as zero credits or block navigation.
  let mobileBalance: number | null = null;
  if (user) {
    try { mobileBalance = (await walletForAccount(user.id)).balance; }
    catch { /* Profile owns the detailed wallet error; no invented number in the header. */ }
  }
  return <html lang="ar" dir="rtl"><body>
    <a href="#main-content" className="skip-link">انتقل إلى المحتوى</a>
    <header className="header"><div className="shell header-inner">
      <Link href="/" className="brand" aria-label="قدّام، الصفحة الرئيسية"><Brand /></Link>
      <nav className="nav" aria-label="التنقل الرئيسي"><Link href={user ? "/games" : "/#games"}>الألعاب</Link>{process.env.ENABLE_NIGHT_OF_QUDDAM === "true" && <Link href="/night">ليلة قدّام</Link>}<Link href="/join">انضم لغرفة</Link><Link href="/#how">كيف نلعب</Link></nav>
      <div className="nav-actions">{user ? <><Link className="btn btn-primary btn-small" href="/games">مكتبتي</Link><details className="account-menu"><summary aria-label="حسابي">حسابي</summary><div><Link href="/profile">ملفي الشخصي · رصيدي</Link><Link href="/pricing">باقات الألعاب</Link>{user.role === "ADMIN" && <Link href="/admin">الإدارة</Link>}</div></details><LogoutButton /></> : <><Link className="btn btn-ghost btn-small" href="/login">دخول</Link><Link className="btn btn-primary btn-small" href="/register">حساب جديد</Link></>}</div>
      <div className="mobile-nav-actions"><Link className="btn btn-primary btn-small mobile-play" href={user ? "/games" : "/#games"}>العب</Link>{user && <Link className="mobile-balance" href="/profile" aria-label={mobileBalance === null ? "الرصيد غير متاح، افتح الملف الشخصي" : `رصيدك: ${mobileBalance} ألعاب`}>{mobileBalance === null ? "رصيدك" : <>رصيدك: <b dir="ltr">{mobileBalance}</b></>}</Link>}<details className="mobile-menu"><summary aria-label="افتح قائمة التنقل">☰</summary><nav aria-label="قائمة الجوال"><Link href={user ? "/games" : "/#games"}>الألعاب</Link>{process.env.ENABLE_NIGHT_OF_QUDDAM === "true" && <Link href="/night">ليلة قدّام</Link>}<Link href="/join">انضم لغرفة</Link><Link href="/#how">كيف نلعب</Link>{user ? <><Link href="/games">مكتبتي</Link><Link href="/profile">حسابي ورصيدي</Link><LogoutButton /></> : <><Link href="/login">دخول</Link><Link href="/register">حساب جديد</Link></>}</nav></details></div>
    </div></header>
    <main id="main-content" tabIndex={-1}>{children}</main>
    <footer className="footer"><div className="shell footer-inner"><span><Brand /> © {formatNumber(new Date().getFullYear(), { useGrouping: false })}</span><span>اللعب يبدأ من هنا · <Link href="/privacy">الخصوصية</Link></span></div></footer>
  </body></html>;
}
