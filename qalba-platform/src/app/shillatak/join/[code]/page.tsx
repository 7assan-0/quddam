import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { previewShillaInvite } from "@/lib/shillatak/service";
import { shillaEnabled, ShillaError, shillaInviteCodeSchema } from "@/lib/shillatak/rules";
import { ShillatakJoin } from "@/components/shillatak-join";
import { ShillatakJoinAuth } from "@/components/shillatak-join-auth";
export const metadata = { robots: { index: false, follow: false } };
export default async function ShillatakJoinPage({ params }: { params: Promise<{ code: string }> }) {
  if (!shillaEnabled()) notFound();
  const parsed = shillaInviteCodeSchema.safeParse((await params).code);
  if (!parsed.success) notFound();
  const code = parsed.data.toLowerCase();
  const user = await currentUser();
  if (!user) return <ShillatakJoinAuth code={code} />;
  let invitation: Awaited<ReturnType<typeof previewShillaInvite>>;
  try { invitation = await previewShillaInvite(user.id, code); }
  catch (error) { if (error instanceof ShillaError && error.status === 404) notFound(); throw error; }
  return <ShillatakJoin code={code} {...invitation} />;
}
