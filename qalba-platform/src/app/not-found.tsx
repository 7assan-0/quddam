import Link from "next/link";
export default function NotFound() { return <div className="shell auth-wrap"><div className="panel auth-card"><span className="eyebrow">404</span><h1>ما لقينا الصفحة</h1><p className="muted">يمكن الرابط تغير أو الصفحة غير متاحة.</p><Link className="btn btn-primary" href="/">الصفحة الرئيسية</Link></div></div>; }
