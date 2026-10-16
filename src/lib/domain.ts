import { z } from "zod";

export const ROWS = "ABCDEFGHIJK".split("");
export const SEATS = ROWS.flatMap(row => Array.from({ length: 18 }, (_, i) => `${row}${String(i + 1).padStart(2, "0")}`));
export const EVENT_ID = "endgame-2026";
export type FilmEvent = {
  id: string; title: string; starts_at: string; venue: string; price: number; capacity: number;
  booking_open: boolean; closes_at: string; max_seats: number;
};
export const INITIAL_EVENT: FilmEvent = {
  id: EVENT_ID, title: "Avengers: Endgame", starts_at: "2026-10-23T16:30:00-05:00",
  venue: "Auditorio de Ciencias Sociales", price: 5, capacity: 198,
  booking_open: true, closes_at: "2026-10-23T16:30:00-05:00", max_seats: 198
};
export type Ticket = {
  id: string; reservation_id: string; event_id: string; seat: string; token: string;
  status: "reserved" | "admitted" | "cancelled"; price: number;
  paid_at: string | null; admitted_at: string | null; admitted_by: string | null; cancelled_at: string | null;
};
export type Reservation = {
  id: string; event_id: string; name: string; access_token: string; request_id: string;
  fingerprint: string; created_at: string;
};
export type Booking = Reservation & { tickets: Ticket[]; event: FilmEvent; mode?: "local" | "supabase" };
export type PublicState = { event: FilmEvent; occupied: string[]; mode: "local" | "supabase" };
export type AdminTicket = Ticket & { name: string; created_at: string };
export type Dashboard = { event: FilmEvent; tickets: AdminTicket[]; mode: "local" | "supabase" };
export type Staff = { id: string; role: "admin" | "door" };
export const reservationSchema = z.object({
  eventId: z.literal(EVENT_ID),
  name: z.string().trim().min(3, "Escribe tu nombre completo.").max(100).refine(v => /\p{L}/u.test(v) && !/[\x00-\x1f<>]/.test(v), "Escribe un nombre válido."),
  seats: z.array(z.string().regex(/^[A-K](0[1-9]|1[0-8])$/)).min(1, "Selecciona al menos una butaca.").max(198)
    .refine(v => new Set(v).size === v.length, "Hay butacas repetidas."),
  requestId: z.uuid(),
  privacyAccepted: z.literal(true, { error: "Debes aceptar el uso de tu nombre para la reserva." }),
  website: z.string().max(0).optional()
});
export type ReserveInput = z.infer<typeof reservationSchema>;
export class AppError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}
export function money(value: number) { return `S/ ${value.toFixed(2)}`; }
export function ticketState(ticket: Ticket) {
  return ticket.status === "cancelled" ? "Cancelada" : ticket.admitted_at ? "Ya utilizada" : "Reservada · pago en puerta";
}
export function bookingIsOpen(event: FilmEvent) {
  return event.booking_open && Date.now() < new Date(event.closes_at).getTime();
}
