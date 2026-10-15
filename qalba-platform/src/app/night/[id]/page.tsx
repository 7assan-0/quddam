import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { NightOfQuddam } from "@/components/night-of-quddam";
import { getNightView, NightServiceError } from "@/lib/night/service";

export default async function NightSessionPage({ params }: { params: Promise<{ id: string }> }) {
  if (process.env.ENABLE_NIGHT_OF_QUDDAM !== "true") notFound();
  const user = await requireUser();
  const { id } = await params;
  let night;
  try { night = await getNightView(user.id, id); }
  catch (error) {
    if (error instanceof NightServiceError && [403, 404].includes(error.status)) notFound();
    throw error;
  }
  return <NightOfQuddam key={night.id} initial={night} />;
}
