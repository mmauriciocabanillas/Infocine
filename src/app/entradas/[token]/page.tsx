import { notFound } from "next/navigation";
import { Entries } from "@/components/entries";
export const dynamic="force-dynamic";
export default async function EntriesPage({params}:{params:Promise<{token:string}>}){const {token}=await params;if(!/^[a-f0-9]{64}$/.test(token))notFound();return <Entries token={token}/>;}
