import {Suspense} from "react";
import {CourtJoin} from "@/components/court-join";
export default function Page(){return <div className="shell"><div className="page-title"><h1>انضم للمحكمة</h1><p>صوتك خاص؛ تحتاج رمز الغرفة واسمًا للمشاركة.</p></div><Suspense fallback={<p>جارٍ التحميل…</p>}><CourtJoin/></Suspense></div>;}
