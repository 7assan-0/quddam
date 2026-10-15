import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";

export default async function NightPage() {
  if (process.env.ENABLE_NIGHT_OF_QUDDAM !== "true") notFound();
  await requireUser();
  return <div className="shell" data-testid="night-home">
    <div className="page-title"><span className="eyebrow">جمعتكم، من لعبة إلى لعبة</span><h1>ليلة قدّام</h1><p>ثلاث ألعاب رسمية، فريقان ثابتان، ولوحة نقاط واحدة تجمع مشوار الليلة حتى إعلان بطلها.</p></div>
    <section className="panel"><h2>جهّزوا سهرتكم</h2><p>اختاروا ترتيب «توب 100» و«رتّبها» و«قالوا الناس»، وسمّوا الفريقين. بعد كل مباراة مكتملة تُضاف نقاط السهرة تلقائيًا من نتيجتها المحفوظة.</p><p>الفائز في المباراة يحصل على ٣ نقاط، والثاني على نقطتين. التعادل محفوظ، وقد يكون لليلة أكثر من بطل.</p><p className="form-note">إنشاء السهرة والتنقل داخلها بلا خصم إضافي. بدء كل مباراة يستهلك لعبة واحدة وفق نظام الرصيد القائم. بعض النتائج تعتمد على تحكيم المضيف داخل اللعبة.</p><div className="utility-links"><Link className="btn btn-primary" href="/night/new">أنشئ سهرة جديدة</Link><Link className="btn btn-secondary" href="/games">العودة إلى الألعاب</Link></div></section>
  </div>;
}
