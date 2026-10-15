import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getShillaView } from "@/lib/shillatak/service";
import { shillaEnabled, ShillaError } from "@/lib/shillatak/rules";
import { ShillatakGroup } from "@/components/shillatak-group";
export const metadata = { robots: { index: false, follow: false } };
export default async function ShillatakGroupPage({ params }: { params: Promise<{ id: string }> }) {
  if (!shillaEnabled()) notFound();
  const user = await requireUser();
  try { return <ShillatakGroup initial={await getShillaView(user.id, (await params).id)} />; }
  catch (error) { if (error instanceof ShillaError && error.status === 404) notFound(); throw error; }
}
