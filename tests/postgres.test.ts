import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { SEATS,type Booking,type AdminTicket,type PublicState } from "../src/lib/domain";
test("Migración PostgreSQL: permisos, atomicidad, aforo, idempotencia, QR y roles",async(t)=>{
  const pg=new PGlite();
  await pg.exec("create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key);");
  await pg.exec(readFileSync("supabase/migrations/202610160001_cine.sql","utf8"));
  // El reloj no forma parte de estas pruebas; dejar la función de prueba en el futuro.
  await pg.exec("update public.cine_events set closes_at=now()+interval '7 days';");
  const organizer=randomUUID(),door=randomUUID();
  await pg.query("insert into auth.users values ($1),($2)",[organizer,door]);await pg.query("insert into public.cine_staff values ($1,'admin'),($2,'door')",[organizer,door]);
  async function rpc<T>(sql:string,args:unknown[]=[]){return (await pg.query<{result:T}>(`select ${sql} as result`,args)).rows[0].result;}
  async function reserve(seats:string[],id:string=randomUUID(),fp:string=randomUUID()){return rpc<Booking>("public.cine_reserve('endgame-2026','Asistente QA',$1::text[],$2::uuid,$3::text)",[seats,id,fp]);}
  let booking:Booking;
  await t.test("198 asientos, estado público sin nombres ni tokens",async()=>{const s=await rpc<PublicState>("public.cine_public_state('endgame-2026')");assert.equal(s.event.capacity,198);assert.deepEqual(s.occupied,[]);assert.equal((await pg.query<{count:number}>("select count(*)::int as count from public.cine_seats")).rows[0].count,198);});
  await t.test("anon y authenticated no pueden leer PII ni ejecutar RPC",async()=>{
    for(const role of ["anon","authenticated"]){await pg.exec(`set role ${role};`);await assert.rejects(()=>pg.query("select * from public.cine_reservations"),/permission denied/);await assert.rejects(()=>rpc("public.cine_dashboard('endgame-2026')"),/permission denied/);await assert.rejects(()=>rpc("public.cine_reserve('endgame-2026','Ataque',array['A01'],gen_random_uuid(),'x')"),/permission denied/);await pg.exec("reset role;");}
  });
  await t.test("service_role puede ejecutar RPC; multi-butaca y QR únicos",async()=>{await pg.exec("set role service_role;");booking=await reserve(["C05","C06","C07"]);assert.equal(booking.tickets.length,3);assert.equal(new Set(booking.tickets.map(t=>t.token)).size,3);assert.equal(booking.tickets.every(t=>!t.paid_at&&!t.admitted_at),true);await pg.exec("reset role;");});
  await t.test("colisión no genera reserva parcial",async()=>{await assert.rejects(()=>reserve(["C04","C05"]),/CONFLICT/);const s=await rpc<PublicState>("public.cine_public_state('endgame-2026')");assert.deepEqual(s.occupied,["C05","C06","C07"]);});
  await t.test("idempotencia conserva entradas y rechaza cambio de payload",async()=>{const id=randomUUID(),fp=randomUUID();const a=await reserve(["D01","D02"],id,fp),b=await reserve(["D01","D02"],id,fp);assert.equal(a.access_token,b.access_token);assert.deepEqual(a.tickets,b.tickets);await assert.rejects(()=>reserve(["D03"],id,"changed"),/IDEMPOTENCY/);});
  await t.test("dos confirmaciones del mismo asiento solo producen un ganador",async()=>{const results=await Promise.allSettled([reserve(["D08"]),reserve(["D08"])]);assert.equal(results.filter(r=>r.status==="fulfilled").length,1);assert.equal(results.filter(r=>r.status==="rejected").length,1);});
  await t.test("límite de aforo y validación de catálogo",async()=>{await assert.rejects(()=>reserve(["A19"]),/SEATS/);await assert.rejects(()=>reserve(["A01","A01"]),/SEATS/);await assert.rejects(()=>reserve([]),/SEATS/);const s=await rpc<PublicState>("public.cine_public_state('endgame-2026')");const b=await reserve(SEATS.filter(seat=>!s.occupied.includes(seat)));assert.equal(b.tickets.length,192);assert.equal((await rpc<PublicState>("public.cine_public_state('endgame-2026')")).occupied.length,198);});
  await t.test("pago e ingreso atómicos y doble escaneo rechazado",async()=>{const token=booking.tickets[0].token;const result=await rpc<AdminTicket>("public.cine_ticket_action('endgame-2026',$1,$2,'admit')",[token,door]);assert.ok(result.paid_at);assert.ok(result.admitted_at);assert.equal(result.admitted_by,door);await assert.rejects(()=>rpc("public.cine_ticket_action('endgame-2026',$1,$2,'admit')",[token,organizer]),/USED/);await assert.rejects(()=>rpc("public.cine_ticket_action('otra-funcion',$1,$2,'admit')",[token,organizer]),/INVALID/);});
  await t.test("solo admin cancela; cancela, libera y mantiene invalidado el QR",async()=>{const token=booking.tickets[1].token;await assert.rejects(()=>rpc("public.cine_ticket_action('endgame-2026',$1,$2,'cancel')",[token,door]),/FORBIDDEN/);await rpc("public.cine_ticket_action('endgame-2026',$1,$2,'cancel')",[token,organizer]);await assert.rejects(()=>rpc("public.cine_ticket_action('endgame-2026',$1,$2,'admit')",[token,organizer]),/CANCELLED/);const next=await reserve(["C06"]);assert.notEqual(next.tickets[0].token,token);});
  await t.test("QR inventado y enlace inexistente rechazados",async()=>{await assert.rejects(()=>rpc("public.cine_verify('endgame-2026',$1)",["f".repeat(64)]),/INVALID/);await assert.rejects(()=>rpc("public.cine_booking($1)",["f".repeat(64)]),/NOT_FOUND/);});
  await t.test("pausa y rate limit persistentes",async()=>{await rpc("public.cine_set_open('endgame-2026',false,$1)",[organizer]);await assert.rejects(()=>reserve(["A01"]),/CLOSED/);await assert.rejects(()=>rpc("public.cine_set_open('endgame-2026',true,$1)",[door]),/FORBIDDEN/);await rpc("public.cine_rate_limit('qa',2,600)");await rpc("public.cine_rate_limit('qa',2,600)");await assert.rejects(()=>rpc("public.cine_rate_limit('qa',2,600)"),/RATE_LIMIT/);});
  await pg.close();
});
