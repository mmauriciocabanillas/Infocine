import "server-only";
import { createClient } from "@supabase/supabase-js";
import { AppError, EVENT_ID, type TicketDeletion, type TicketDeletionResult, type AdminTicket, type Booking, type FilmEvent, type ReserveInput } from "./domain";
import { LocalStore, fingerprintFor } from "./local-store";

export function backend(): "local" | "supabase" {
  const mode = process.env.DATA_BACKEND ?? "supabase";
  if (mode === "supabase") return mode;
  if (mode === "local" && !process.env.VERCEL) return mode;
  throw new AppError("CONFIG", "El servicio todavía no está configurado.", 503);
}
export function supabaseAdmin() {
  const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new AppError("CONFIG", "Falta conectar Supabase.", 503);
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export function supabaseAuth() {
  const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new AppError("CONFIG", "Falta configurar el acceso del personal.", 503);
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
const globalStore = globalThis as unknown as { cineLocal?: LocalStore };
function local() { return globalStore.cineLocal ??= new LocalStore(process.env.LOCAL_DB_PATH); }
async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabaseAdmin().rpc(name,args);
  if (error) {
    const messages: Record<string,[string,number]> = {
      CONFLICT:["Alguien acaba de reservar una de tus butacas. Revisa el plano y elige de nuevo.",409],
      SEAT_LIMIT:["Puedes reservar un máximo de 4 butacas.",409],
      PERSON_LIMIT:["Este nombre ya tiene entradas. El máximo es de 4 butacas en total.",409],
      CONFIRMATION:["Escribe la confirmación para borrar las entradas.",400],
      CLOSED:["Las reservas de esta función están cerradas.",409],
      USED:["Esta entrada ya fue utilizada.",409], CANCELLED:["Esta entrada está cancelada.",409],
      NOT_FOUND:["No encontramos esas entradas. Revisa tu enlace privado.",404],
      INVALID:["QR no válido para esta función.",404], IDEMPOTENCY:["La operación cambió. Vuelve a confirmar.",409],
      RATE_LIMIT:["Demasiados intentos. Espera unos minutos.",429], FORBIDDEN:["No tienes permiso para esta acción.",403],
      SEATS:["Selección de butacas no válida.",400], NAME:["Escribe un nombre válido.",400]
    };
    const code=Object.keys(messages).find(c=>error.message.includes(c));
    if(code) throw new AppError(code,...messages[code]);
    console.error("Supabase RPC",name,error.code);
    throw new AppError("DATABASE","No pudimos completar la operación. Intenta nuevamente.",503);
  }
  return data as T;
}
export const store = {
  async state() { if(backend()==="local") return {event:local().event(),occupied:local().occupied(),mode:backend()}; return {...await rpc<{event:FilmEvent;occupied:string[]}>("cine_public_state",{p_event:EVENT_ID}),mode:backend()}; },
  async reserve(input:ReserveInput) { const fingerprint=fingerprintFor(input); return backend()==="local" ? local().reserve(input,fingerprint) : rpc<Booking>("cine_reserve",{p_event:input.eventId,p_name:input.name,p_seats:input.seats,p_request:input.requestId,p_fingerprint:fingerprint}); },
  async booking(token:string) { return backend()==="local" ? local().booking(token) : rpc<Booking>("cine_booking",{p_access:token}); },
  async dashboard() { if(backend()==="local") return {event:local().event(),tickets:local().dashboard(),mode:backend()}; return {...await rpc<{event:FilmEvent;tickets:AdminTicket[]}>("cine_dashboard",{p_event:EVENT_ID}),mode:backend()}; },
  async verify(token:string) { return backend()==="local" ? local().verify(token) : rpc<AdminTicket>("cine_verify",{p_event:EVENT_ID,p_token:token}); },
  async mutate(token:string,actor:string,action:"admit"|"cancel") { return backend()==="local" ? local().mutate(token,actor,action) : rpc<AdminTicket>("cine_ticket_action",{p_event:EVENT_ID,p_token:token,p_actor:actor,p_action:action}); },
  async setOpen(open:boolean,actor:string) { return backend()==="local" ? local().setOpen(open) : rpc<FilmEvent>("cine_set_open",{p_event:EVENT_ID,p_open:open,p_actor:actor}); },
  async deleteTickets(input:TicketDeletion,actor:string) {
    return backend()==="local" ? local().deleteTickets(input) : rpc<TicketDeletionResult>("cine_delete_tickets",{p_event:EVENT_ID,p_actor:actor,p_action:input.action,p_ids:input.action==="delete"?input.ids:null,p_confirmation:input.confirmation});
  },
  async rateLimit(key:string,limit:number,seconds:number) { if(backend()==="local") return local().rateLimit(key,limit,seconds); await rpc("cine_rate_limit",{p_key:key,p_limit:limit,p_seconds:seconds}); }
};
