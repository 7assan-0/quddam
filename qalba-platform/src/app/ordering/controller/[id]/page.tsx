import { notFound } from "next/navigation";
import { OrderingError } from "@/lib/games/ordering/module";
import { getOrderingView } from "@/lib/games/ordering/service";
import { OrderingController } from "@/components/ordering-controller";
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }> }) { const id = (await params).id, token = (await searchParams).token ?? ""; let initial; try { initial = await getOrderingView(id, { kind: "CONTROLLER", token }); } catch (error) { if (error instanceof OrderingError && [403, 404, 410].includes(error.status)) notFound(); throw error; } return <OrderingController initial={initial} token={token} />; }
