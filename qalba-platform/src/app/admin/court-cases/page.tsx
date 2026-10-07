import {requireUser} from "@/lib/auth/session";
import {notFound} from "next/navigation";
import {db} from "@/lib/db";
import {CourtManager} from "@/components/court-manager";
export default async function Page(){if((await requireUser()).role!=="ADMIN")notFound();const categories=await db().category.findMany({where:{active:true},select:{id:true,title:true},orderBy:{title:"asc"}});return <div className="shell"><div className="page-title"><h1>قضايا المحكمة</h1><p>مواقف خيالية للترفيه، وحجتان متوازنتان وحقائق محايدة.</p></div><CourtManager categories={categories}/></div>;}
