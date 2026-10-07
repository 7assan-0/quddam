import {Suspense} from "react";
import {BluffJoin} from "@/components/bluff-join";
export default function Join(){return <div className="shell"><div className="page-title"><h1>ادخل صدّقني</h1><p>كل لاعب من جواله.</p></div><Suspense fallback={<p>جارٍ التحميل…</p>}><BluffJoin/></Suspense></div>;}
