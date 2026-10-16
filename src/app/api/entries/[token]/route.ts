import { z } from "zod";
import { handle } from "@/lib/http";
import { backend,store } from "@/lib/store";
export const runtime="nodejs";
export async function GET(request:Request,{params}:{params:Promise<{token:string}>}) { return handle(request,async()=>{
  const {token}=await params;z.string().regex(/^[a-f0-9]{64}$/).parse(token);return {...await store.booking(token),mode:backend()};
}); }
