import {requireUser} from "@/lib/auth/session";
import {RankedSetup} from "@/components/ranked-setup";
export default async function Page(){await requireUser();return <RankedSetup/>;}
