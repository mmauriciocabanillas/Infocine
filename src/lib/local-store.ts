import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { AppError, INITIAL_EVENT, SEATS, type Booking, type FilmEvent, type ReserveInput, type Reservation, type Ticket, type AdminTicket } from "./domain";

export class LocalStore {
  db: DatabaseSync;
  constructor(path = resolve(".data/cine.sqlite")) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS reservations(id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id), name TEXT NOT NULL, access_token TEXT NOT NULL UNIQUE, request_id TEXT NOT NULL UNIQUE, fingerprint TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS tickets(id TEXT PRIMARY KEY, reservation_id TEXT NOT NULL REFERENCES reservations(id), event_id TEXT NOT NULL REFERENCES events(id), seat TEXT NOT NULL, token TEXT NOT NULL UNIQUE, status TEXT NOT NULL CHECK(status IN ('reserved','admitted','cancelled')), price REAL NOT NULL, paid_at TEXT, admitted_at TEXT, admitted_by TEXT, cancelled_at TEXT);
      CREATE UNIQUE INDEX IF NOT EXISTS active_seat ON tickets(event_id,seat) WHERE status <> 'cancelled';
      CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY, ticket_id TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY, count INTEGER NOT NULL, resets_at INTEGER NOT NULL);`);
    this.db.prepare("INSERT OR IGNORE INTO events VALUES (?,?)").run(INITIAL_EVENT.id, JSON.stringify(INITIAL_EVENT));
  }
  event(): FilmEvent { return JSON.parse((this.db.prepare("SELECT data FROM events WHERE id=?").get(INITIAL_EVENT.id) as { data: string }).data); }
  occupied() { return (this.db.prepare("SELECT seat FROM tickets WHERE event_id=? AND status<>'cancelled'").all(INITIAL_EVENT.id) as { seat: string }[]).map(t=>t.seat); }
  booking(access: string): Booking {
    const r = this.db.prepare("SELECT * FROM reservations WHERE access_token=?").get(access) as Reservation | undefined;
    if (!r) throw new AppError("NOT_FOUND", "No encontramos esas entradas. Revisa tu enlace privado.", 404);
    return { ...r, tickets: this.db.prepare("SELECT * FROM tickets WHERE reservation_id=? ORDER BY seat").all(r.id) as Ticket[], event: this.event() };
  }
  reserve(input: ReserveInput, fingerprint: string): Booking {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const previous = this.db.prepare("SELECT * FROM reservations WHERE request_id=?").get(input.requestId) as Reservation | undefined;
      if (previous) {
        if (previous.fingerprint !== fingerprint) throw new AppError("IDEMPOTENCY", "La operación cambió. Vuelve a confirmar.", 409);
        const result = this.booking(previous.access_token); this.db.exec("COMMIT"); return result;
      }
      const event = this.event();
      if (!event.booking_open || new Date(event.closes_at).getTime() <= Date.now()) throw new AppError("CLOSED", "Las reservas de esta función están cerradas.", 409);
      if (!input.seats.length || input.seats.length > event.max_seats || new Set(input.seats).size !== input.seats.length || input.seats.some(s=>!SEATS.includes(s))) throw new AppError("SEATS", "Selección de butacas no válida.");
      const occupied = new Set(this.occupied());
      if (input.seats.some(s => occupied.has(s))) throw new AppError("CONFLICT", "Alguien acaba de reservar una de tus butacas. Revisa el plano y elige de nuevo.", 409);
      const r: Reservation = { id: randomUUID(), event_id: event.id, name: input.name, access_token: randomBytes(32).toString("hex"), request_id: input.requestId, fingerprint, created_at: new Date().toISOString() };
      this.db.prepare("INSERT INTO reservations VALUES (?,?,?,?,?,?,?)").run(r.id,r.event_id,r.name,r.access_token,r.request_id,r.fingerprint,r.created_at);
      const insert = this.db.prepare("INSERT INTO tickets VALUES (?,?,?,?,?,'reserved',?,NULL,NULL,NULL,NULL)");
      for (const seat of [...input.seats].sort()) insert.run(randomUUID(),r.id,event.id,seat,randomBytes(32).toString("hex"),event.price);
      const result = this.booking(r.access_token); this.db.exec("COMMIT"); return result;
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  dashboard(): AdminTicket[] {
    return this.db.prepare("SELECT t.*,r.name,r.created_at FROM tickets t JOIN reservations r ON r.id=t.reservation_id WHERE t.event_id=? ORDER BY r.created_at DESC,t.seat").all(INITIAL_EVENT.id) as AdminTicket[];
  }
  verify(token: string): AdminTicket {
    const ticket = this.db.prepare("SELECT t.*,r.name,r.created_at FROM tickets t JOIN reservations r ON r.id=t.reservation_id WHERE t.token=? AND t.event_id=?").get(token, INITIAL_EVENT.id) as AdminTicket | undefined;
    if (!ticket) throw new AppError("INVALID", "QR no válido para esta función.", 404);
    return ticket;
  }
  mutate(token: string, actor: string, action: "admit" | "cancel"): AdminTicket {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const ticket = this.verify(token);
      if (ticket.status === "cancelled") throw new AppError("CANCELLED", "Esta entrada está cancelada.", 409);
      if (ticket.admitted_at) throw new AppError("USED", "Esta entrada ya fue utilizada.", 409);
      const now = new Date().toISOString();
      if (action === "admit") this.db.prepare("UPDATE tickets SET status='admitted', paid_at=?, admitted_at=?, admitted_by=? WHERE id=? AND status='reserved'").run(now,now,actor,ticket.id);
      else this.db.prepare("UPDATE tickets SET status='cancelled',cancelled_at=? WHERE id=? AND status='reserved'").run(now,ticket.id);
      this.db.prepare("INSERT INTO audit VALUES(?,?,?,?,?)").run(randomUUID(),ticket.id,actor,action,now);
      const result = this.verify(token); this.db.exec("COMMIT"); return result;
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  setOpen(open: boolean) { const event = { ...this.event(), booking_open: open }; this.db.prepare("UPDATE events SET data=? WHERE id=?").run(JSON.stringify(event),event.id); return event; }
  rateLimit(key: string, limit: number, seconds: number) {
    const now = Math.floor(Date.now()/1000);
    const row = this.db.prepare(`INSERT INTO rate_limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN resets_at<=? THEN 1 ELSE count+1 END,resets_at=CASE WHEN resets_at<=? THEN excluded.resets_at ELSE resets_at END RETURNING count`).get(key,now+seconds,now,now) as {count:number};
    if (row.count > limit) throw new AppError("RATE_LIMIT", "Demasiados intentos. Espera unos minutos y vuelve a intentar.", 429);
    this.db.prepare("DELETE FROM rate_limits WHERE resets_at<?").run(now-3600);
  }
  close() { this.db.close(); }
}
export function fingerprintFor(input: ReserveInput) { return createHash("sha256").update(JSON.stringify([input.eventId,input.name,[...input.seats].sort()])).digest("hex"); }
