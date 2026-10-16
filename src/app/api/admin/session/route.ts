import { z } from "zod";
import { handle,rateLimit,readBody } from "@/lib/http";
import { signIn,signOut,requireStaff } from "@/lib/auth";
import { backend } from "@/lib/store";
export const runtime="nodejs";
export async function GET(request:Request) { return handle(request,async()=>({staff:await requireStaff(),mode:backend()})); }
export async function POST(request:Request) { return handle(request,async()=>{
  await rateLimit(request,"login",10,600);
  const {email,password}=z.object({email:z.string().max(254),password:z.string().min(1).max(256)}).parse(await readBody(request));
  return {staff:await signIn(email,password),mode:backend()};
}); }
export async function DELETE(request:Request) { return handle(request,async()=>{await signOut();return {ok:true};}); }
