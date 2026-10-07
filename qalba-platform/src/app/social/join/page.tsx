import { Suspense } from "react";
import { SocialJoin } from "@/components/social-join";
export default function JoinSocialPage() { return <main className="shell social-page"><div className="page-title"><span className="eyebrow">خارج الجو</span><h1>ادخل الغرفة</h1><p>اطلب الرمز من المضيف واختر اسمك من جوالك.</p></div><Suspense fallback={<p>جارٍ التحميل…</p>}><SocialJoin /></Suspense></main>; }
