import {requireUser} from "@/lib/auth/session";
import {OrderingSetup} from "@/components/ordering-setup";
export default async function Page(){await requireUser();return <OrderingSetup/>;}
