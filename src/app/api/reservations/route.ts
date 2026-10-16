import { reservationSchema } from "@/lib/domain";
import { handle, rateLimit, readBody } from "@/lib/http";
import { store } from "@/lib/store";
export const runtime="nodejs";
export async function POST(request:Request) { return handle(request,async()=>{
  // Una red universitaria puede compartir una sola IP: permitir el aforo completo y sus reintentos.
  await rateLimit(request,"reserve",600,600);
  const input=reservationSchema.parse(await readBody(request));
  const booking=await store.reserve(input);
  return {accessToken:booking.access_token};
}); }
