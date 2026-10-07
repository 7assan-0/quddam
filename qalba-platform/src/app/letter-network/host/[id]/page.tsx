import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getLetterView } from "@/lib/games/letter-network/service";
import { LetterError } from "@/lib/games/letter-network/module";
import { LetterHost } from "@/components/letter-host";
export default async function LetterHostPage({params}:{params:Promise<{id:string}>}){
  const user=await requireUser();let view;
  try{view=await getLetterView((await params).id,{kind:"HOST",id:user.id});}catch(error){if(error instanceof LetterError&&[403,404].includes(error.status))notFound();throw error;}
  return <LetterHost initial={view}/>;
}

