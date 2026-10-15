import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { previewShillaInvite } from "@/lib/shillatak/service";
import { shillaEnabled, ShillaError } from "@/lib/shillatak/rules";
import { ShillatakJoin } from "@/components/shillatak-join";
export const metadata = { robots: { index: false, follow: false } };
export default async function ShillatakJoinPage({ params }: { params: Promise<{ code: string }> }) {
  if (!shillaEnabled()) notFound();
  const user = await requireUser();
  const { code } = await params;
  try { return <ShillatakJoin code={code} {...await previewShillaInvite(user.id, code)} />; }
  catch (error) { if (error instanceof ShillaError && error.status === 404) notFound(); throw error; }
}
