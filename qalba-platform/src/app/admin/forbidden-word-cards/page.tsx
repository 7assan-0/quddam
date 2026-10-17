import {notFound} from "next/navigation";
import {requireUser} from "@/lib/auth/session";
import {db} from "@/lib/db";
import {ForbiddenCardManager} from "@/components/forbidden-card-manager";
export default async function Page(){const user=await requireUser();if(user.role!=="ADMIN")notFound();const [cards,categories]=await Promise.all([db().forbiddenWordCard.findMany({orderBy:{createdAt:"desc"},take:500}),db().category.findMany({where:{active:true},select:{id:true,title:true},orderBy:{sortOrder:"asc"}})]);return <div className="shell forbidden-page"><div className="page-title"><span className="eyebrow">إدارة المحتوى</span><h1>بطاقات الكلمة الممنوعة</h1><p>3–6 كلمات ممنوعة مختلفة. نسخ البطاقات في المباريات محفوظة ولا تتغيّر بالتعديل.</p></div><ForbiddenCardManager initial={cards.map(c=>({id:c.id,targetWord:c.targetWord,forbiddenWords:c.forbiddenWords,categoryId:c.categoryId,difficulty:c.difficulty,status:c.status}))} categories={categories}/></div>;}
