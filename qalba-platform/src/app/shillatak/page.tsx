import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { listMyShillas } from "@/lib/shillatak/service";
import { shillaEnabled } from "@/lib/shillatak/rules";
import { ShillatakHome } from "@/components/shillatak-home";
export const metadata = { robots: { index: false, follow: false } };
export default async function ShillatakPage() {
  if (!shillaEnabled()) notFound();
  const user = await requireUser();
  return <ShillatakHome initial={await listMyShillas(user.id)} />;
}
