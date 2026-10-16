import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { handle,readBody } from "@/lib/http";
import { store } from "@/lib/store";
export const runtime="nodejs";
export async function GET(request:Request) { return handle(request,async()=>{const staff=await requireStaff();return {...await store.dashboard(),role:staff.role};}); }
export async function PATCH(request:Request) { return handle(request,async()=>{const staff=await requireStaff(true);const {open}=z.object({open:z.boolean()}).parse(await readBody(request));return store.setOpen(open,staff.id);}); }
