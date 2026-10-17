import { requireUser } from "@/lib/auth/session";
import { SurveySetup } from "@/components/survey-setup";
export default async function SurveyNewPage(){await requireUser();return <div className="shell survey-page"><div className="page-title"><span className="eyebrow">فريقان · 20 إلى 35 دقيقة</span><h1>قالوا الناس</h1><p>توقعوا الإجابات، اكشفوا اللوحة ونافسوا على وعاء الجولة.</p></div><SurveySetup/></div>;}
