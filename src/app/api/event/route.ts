import { handle } from "@/lib/http";
import { store } from "@/lib/store";
export const runtime="nodejs";
export async function GET(request:Request) { return handle(request,()=>store.state()); }
