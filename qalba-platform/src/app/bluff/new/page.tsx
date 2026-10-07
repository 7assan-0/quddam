import {requireUser} from "@/lib/auth/session";
import {BluffSetup} from "@/components/bluff-setup";
export default async function NewBluff(){await requireUser();return <BluffSetup/>;}
