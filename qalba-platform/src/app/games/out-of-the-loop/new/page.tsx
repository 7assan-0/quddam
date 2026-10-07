import { requireUser } from "@/lib/auth/session";
import { SocialSetup } from "@/components/social-setup";
export default async function SocialNewPage() { await requireUser(); return <main className="shell"><div className="page-title"><span className="eyebrow">خارج الجو</span><h1>من اللي ما يعرف الكلمة؟</h1><p>كل لاعب له بطاقة سرية على جواله. اسألوا وصوّتوا وخمّنوا.</p></div><SocialSetup /></main>; }
