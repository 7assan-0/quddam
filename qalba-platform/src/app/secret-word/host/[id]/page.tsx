import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getForbiddenView } from "@/lib/games/forbidden-word/service";
import { ForbiddenWordError } from "@/lib/games/forbidden-word/module";
import { ForbiddenHost } from "@/components/forbidden-host";
export default async function ForbiddenHostPage({params}:{params:Promise<{id:string}>}){
  const user=await requireUser();let view;
  try{view=await getForbiddenView((await params).id,{kind:"HOST",id:user.id});}catch(error){if(error instanceof ForbiddenWordError&&[403,404].includes(error.status))notFound();throw error;}
  return <ForbiddenHost initial={view}/>;
}

