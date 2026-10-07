import {requireUser} from "@/lib/auth/session";
import {notFound} from "next/navigation";
import {db} from "@/lib/db";
import {RankedManager} from "@/components/ranked-manager";
export default async function Page(){const user=await requireUser();if(user.role!=="ADMIN")notFound();const categories=await db().category.findMany({where:{active:true},select:{id:true,title:true},orderBy:{title:"asc"}});return <RankedManager categories={categories}/>;}
