"use client";
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) { return <div className="shell auth-wrap"><div className="panel auth-card"><span className="eyebrow">تعذّر التحميل</span><h1>واجهنا مشكلة مؤقتة</h1><p className="muted">جرّب إعادة تحميل هذا الجزء.</p><button className="btn btn-primary" onClick={reset}>إعادة المحاولة</button></div></div>; }
