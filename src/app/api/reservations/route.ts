import { reservationSchema } from "@/lib/domain";
import { handle, rateLimit, readBody } from "@/lib/http";
import { store } from "@/lib/store";
import { RESERVATION_ATTEMPTS, RESERVATION_WINDOW_SECONDS } from "@/lib/reservation-security";
export const runtime="nodejs";
export async function POST(request:Request) { return handle(request,async()=>{
  // El contador persiste en Supabase y se comparte entre todas las instancias de Vercel.
  await rateLimit(request,"reserve",RESERVATION_ATTEMPTS,RESERVATION_WINDOW_SECONDS);
  const input=reservationSchema.parse(await readBody(request));
  const booking=await store.reserve(input);
  return {accessToken:booking.access_token};
}); }
