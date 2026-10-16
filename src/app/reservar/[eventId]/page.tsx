import { notFound } from "next/navigation";
import { EVENT_ID } from "@/lib/domain";
import { ReservationForm } from "@/components/reservation";
export default async function ReservePage({params}:{params:Promise<{eventId:string}>}){if((await params).eventId!==EVENT_ID)notFound();return <ReservationForm/>;}
