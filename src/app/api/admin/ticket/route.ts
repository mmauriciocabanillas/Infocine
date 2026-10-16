import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { handle,readBody } from "@/lib/http";
import { store } from "@/lib/store";
export const runtime="nodejs";
const schema=z.object({token:z.string().regex(/^[a-f0-9]{64}$/),action:z.enum(["verify","admit","cancel"])});
export async function POST(request:Request) { return handle(request,async()=>{
  const data=schema.parse(await readBody(request));const staff=await requireStaff(data.action==="cancel");
  return data.action==="verify" ? store.verify(data.token) : store.mutate(data.token,staff.id,data.action);
}); }
