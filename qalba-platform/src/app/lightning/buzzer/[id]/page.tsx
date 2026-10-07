import { notFound } from "next/navigation";
import { LightningError } from "@/lib/games/lightning/module";
import { getLightningView } from "@/lib/games/lightning/service";
import { LightningBuzzer } from "@/components/lightning-buzzer";
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }> }) { const id = (await params).id, token = (await searchParams).token ?? ""; let initial; try { initial = await getLightningView(id, { kind: "BUZZER", token }); } catch (error) { if (error instanceof LightningError && [403, 404, 410].includes(error.status)) notFound(); throw error; } return <LightningBuzzer initial={initial} token={token} />; }
