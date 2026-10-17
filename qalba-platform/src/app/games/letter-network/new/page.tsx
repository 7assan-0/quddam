import { requireUser } from "@/lib/auth/session";
import { LetterSetup } from "@/components/letter-setup";
export default async function LetterNewPage(){await requireUser();return <div className="shell letter-page"><div className="page-title"><span className="eyebrow">فريقان · 20 إلى 35 دقيقة</span><h1>شبكة الحروف</h1><p>معرفة واستراتيجية: جاوبوا بحرف الخلية واربطوا مسار الفوز.</p></div><LetterSetup/></div>;}

