import {requireUser} from "@/lib/auth/session";
import {ForbiddenSetup} from "@/components/forbidden-setup";
export default async function Page(){await requireUser();return <div className="shell forbidden-page"><div className="page-title"><span className="eyebrow">الكلمة الممنوعة</span><h1>صف الكلمة دون قول المحظور</h1><p>فريقان، ثلاث جولات لكل فريق، وستون ثانية في الجولة.</p></div><ForbiddenSetup/></div>;}
