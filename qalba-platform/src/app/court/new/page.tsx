import {requireUser} from "@/lib/auth/session";
import {CourtSetup} from "@/components/court-setup";
export default async function Page(){await requireUser();return <CourtSetup/>;}
