import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { NightOfQuddamSetup } from "@/components/night-of-quddam-setup";

export default async function NewNightPage() {
  if (process.env.ENABLE_NIGHT_OF_QUDDAM !== "true") notFound();
  await requireUser();
  return <NightOfQuddamSetup />;
}
