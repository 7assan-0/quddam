import {requireUser} from "@/lib/auth/session";
import {LightningSetup} from "@/components/lightning-setup";
export default async function Page(){await requireUser();return <LightningSetup/>;}
