import {requireUser} from "@/lib/auth/session";
import {notFound} from "next/navigation";
import {db} from "@/lib/db";
import {OrderingManager} from "@/components/ordering-manager";
export default async function Page(){const user=await requireUser();if(user.role!=="ADMIN")notFound();const categories=await db().category.findMany({where:{active:true},select:{id:true,title:true},orderBy:{title:"asc"}});return <div className="shell"><div className="page-title"><h1>تحديات رتّبها</h1><p>٤–٨ عناصر ومواضع متتالية ومصادر للتحديات الواقعية.</p></div><OrderingManager categories={categories}/></div>;}
