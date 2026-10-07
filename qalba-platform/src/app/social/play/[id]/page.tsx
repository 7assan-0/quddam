import { notFound } from "next/navigation";
import { cookieName, getSocialView } from "@/lib/games/social-deduction/service";
import { SocialError } from "@/lib/games/social-deduction/module";
import { cookies } from "next/headers";
import { SocialPlayer } from "@/components/social-player";
export default async function SocialPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const token = (await cookies()).get(cookieName(id))?.value ?? "";
  let view; try { view = await getSocialView(id, { kind: "PLAYER", token }); }
  catch (error) { if (error instanceof SocialError && [403, 404].includes(error.status)) notFound(); throw error; }
  return <SocialPlayer initial={view} />;
}
