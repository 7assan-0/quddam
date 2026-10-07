import { Suspense } from "react";
import { RoomJoin } from "@/components/room-join";
export default function JoinPage() { return <main className="shell room-page"><span className="eyebrow">العبوا من جوالاتكم</span><h1>ادخلوا الجمْعة</h1><p>اطلب رمز الغرفة من المضيف، واختر اسمك وفريقك.</p><Suspense fallback={<p>جارٍ التحميل...</p>}><RoomJoin /></Suspense></main>; }
