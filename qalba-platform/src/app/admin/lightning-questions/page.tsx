import {requireUser} from "@/lib/auth/session";
import {notFound} from "next/navigation";
import {db} from "@/lib/db";
import {LightningManager} from "@/components/lightning-manager";
export default async function Page(){const user=await requireUser();if(user.role!=="ADMIN")notFound();const categories=await db().category.findMany({where:{active:true},select:{id:true,title:true},orderBy:{title:"asc"}});return <div className="shell"><div className="page-title"><h1>أسئلة البرق</h1><p>أسئلة قصيرة وإجابات خاصة بالمضيف، وبدائل فريدة بعد التطبيع.</p></div><LightningManager categories={categories}/></div>;}
