import {notFound} from "next/navigation";
import {requireUser} from "@/lib/auth/session";
import {db} from "@/lib/db";
import {BluffQuestionManager} from "@/components/bluff-question-manager";
export default async function Questions(){if((await requireUser()).role!=="ADMIN")notFound();const categories=await db().category.findMany({where:{active:true},orderBy:{sortOrder:"asc"},select:{id:true,title:true}});return <div className="shell"><div className="page-title"><h1>أسئلة صدّقني</h1><p>حقائق قصيرة وإجابات واضحة، مع مراجعة المحتوى قبل النشر.</p></div><BluffQuestionManager categories={categories}/></div>;}
