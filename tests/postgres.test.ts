import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { type Booking,type AdminTicket,type PublicState,type TicketDeletionResult } from "../src/lib/domain";
test("Migración PostgreSQL: permisos, atomicidad, aforo, idempotencia, QR y roles",async(t)=>{
  const pg=new PGlite();
  await pg.exec("create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key);");
  await pg.exec(readFileSync("supabase/migrations/202610160001_cine.sql","utf8"));
  // El reloj no forma parte de estas pruebas; dejar la función de prueba en el futuro.
  await pg.exec("update public.cine_events set closes_at=now()+interval '7 days';");
  const organizer=randomUUID(),door=randomUUID();
  await pg.query("insert into auth.users values ($1),($2)",[organizer,door]);await pg.query("insert into public.cine_staff values ($1,'admin'),($2,'door')",[organizer,door]);
  async function rpc<T>(sql:string,args:unknown[]=[]){return (await pg.query<{result:T}>(`select ${sql} as result`,args)).rows[0].result;}
  async function reserve(seats:string[],id:string=randomUUID(),fp:string=randomUUID(),name=`Asistente QA ${randomUUID()}`){return rpc<Booking>("public.cine_reserve('endgame-2026',$4::text,$1::text[],$2::uuid,$3::text)",[seats,id,fp,name]);}
  async function remove(action:string,ids:string[]|null,confirmation:string,actor=organizer){return rpc<TicketDeletionResult>("public.cine_delete_tickets('endgame-2026',$1::uuid,$2::text,$3::uuid[],$4::text)",[actor,action,ids,confirmation]);}
  let booking:Booking;
  await t.test("Actualizar una base existente conserva reservas antiguas y permite repetir la migración",async()=>{
    const legacy=await reserve(["K01","K02","K03","K04","K05"]);
    const migration=readFileSync("supabase/migrations/202610190001_limits_and_bulk_delete.sql","utf8");await pg.exec(migration);await pg.exec(migration);
    const preserved=await rpc<Booking>("public.cine_booking($1)",[legacy.access_token]);assert.equal(preserved.tickets.length,5);assert.equal(preserved.event.max_seats,4);
    assert.equal((await remove("delete",legacy.tickets.map(t=>t.id),"ELIMINAR")).deleted,5);
  });
  await t.test("198 asientos, estado público sin nombres ni tokens",async()=>{const s=await rpc<PublicState>("public.cine_public_state('endgame-2026')");assert.equal(s.event.capacity,198);assert.deepEqual(s.occupied,[]);assert.equal((await pg.query<{count:number}>("select count(*)::int as count from public.cine_seats")).rows[0].count,198);});
  await t.test("anon y authenticated no pueden leer PII ni ejecutar RPC",async()=>{
    for(const role of ["anon","authenticated"]){await pg.exec(`set role ${role};`);await assert.rejects(()=>pg.query("select * from public.cine_reservations"),/permission denied/);await assert.rejects(()=>rpc("public.cine_dashboard('endgame-2026')"),/permission denied/);await assert.rejects(()=>rpc("public.cine_reserve('endgame-2026','Ataque',array['A01'],gen_random_uuid(),'x')"),/permission denied/);await assert.rejects(()=>remove("clear",null,"ELIMINAR TODO"),/permission denied/);await pg.exec("reset role;");}
  });
  await t.test("service_role puede ejecutar RPC; multi-butaca y QR únicos",async()=>{await pg.exec("set role service_role;");booking=await reserve(["C05","C06","C07"]);assert.equal(booking.tickets.length,3);assert.equal(new Set(booking.tickets.map(t=>t.token)).size,3);assert.equal(booking.tickets.every(t=>!t.paid_at&&!t.admitted_at),true);await pg.exec("reset role;");});
  await t.test("colisión no genera reserva parcial",async()=>{await assert.rejects(()=>reserve(["C04","C05"]),/CONFLICT/);const s=await rpc<PublicState>("public.cine_public_state('endgame-2026')");assert.deepEqual(s.occupied,["C05","C06","C07"]);});
  await t.test("idempotencia conserva entradas y rechaza cambio de payload",async()=>{const id=randomUUID(),fp=randomUUID();const a=await reserve(["D01","D02"],id,fp),b=await reserve(["D01","D02"],id,fp);assert.equal(a.access_token,b.access_token);assert.deepEqual(a.tickets,b.tickets);await assert.rejects(()=>reserve(["D03"],id,"changed"),/IDEMPOTENCY/);});
  await t.test("dos confirmaciones del mismo asiento solo producen un ganador",async()=>{const results=await Promise.allSettled([reserve(["D08"]),reserve(["D08"])]);assert.equal(results.filter(r=>r.status==="fulfilled").length,1);assert.equal(results.filter(r=>r.status==="rejected").length,1);});
  await t.test("máximo de cuatro acumuladas por nombre y validación de catálogo",async()=>{
    await assert.rejects(()=>reserve(["A19"]),/SEATS/);await assert.rejects(()=>reserve(["A01","A01"]),/SEATS/);await assert.rejects(()=>reserve([]),/SEATS/);
    await assert.rejects(()=>reserve(["A01","A02","A03","A04","A05"]),/SEAT_LIMIT/);
    const a=await reserve(["G01","G02"],randomUUID(),randomUUID(),"José  Muñoz");
    const outcomes=await Promise.allSettled([reserve(["G03","G04"],randomUUID(),randomUUID(),"JOSE MUNOZ"),reserve(["G05","G06"],randomUUID(),randomUUID(),"jose muñoz")]);
    assert.equal(outcomes.filter(r=>r.status==="fulfilled").length,1);assert.match(String((outcomes.find(r=>r.status==="rejected") as PromiseRejectedResult).reason),/PERSON_LIMIT/);
    await rpc("public.cine_ticket_action('endgame-2026',$1,$2,'admit')",[a.tickets[0].token,door]);
    await assert.rejects(()=>reserve(["G07"],randomUUID(),randomUUID(),"jose munoz"),/PERSON_LIMIT/);
    await rpc("public.cine_ticket_action('endgame-2026',$1,$2,'cancel')",[a.tickets[1].token,organizer]);
    const last=await reserve(["G07"],randomUUID(),randomUUID(),"jose munoz");assert.equal(last.tickets.length,1);
    const all=await rpc<{tickets:AdminTicket[]}>("public.cine_dashboard('endgame-2026')");await remove("delete",all.tickets.filter(t=>t.seat.startsWith("G")).map(t=>t.id),"ELIMINAR");
  });
  await t.test("pago e ingreso atómicos y doble escaneo rechazado",async()=>{const token=booking.tickets[0].token;const result=await rpc<AdminTicket>("public.cine_ticket_action('endgame-2026',$1,$2,'admit')",[token,door]);assert.ok(result.paid_at);assert.ok(result.admitted_at);assert.equal(result.admitted_by,door);await assert.rejects(()=>rpc("public.cine_ticket_action('endgame-2026',$1,$2,'admit')",[token,organizer]),/USED/);await assert.rejects(()=>rpc("public.cine_ticket_action('otra-funcion',$1,$2,'admit')",[token,organizer]),/INVALID/);});
  await t.test("solo admin cancela; cancela, libera y mantiene invalidado el QR",async()=>{const token=booking.tickets[1].token;await assert.rejects(()=>rpc("public.cine_ticket_action('endgame-2026',$1,$2,'cancel')",[token,door]),/FORBIDDEN/);await rpc("public.cine_ticket_action('endgame-2026',$1,$2,'cancel')",[token,organizer]);await assert.rejects(()=>rpc("public.cine_ticket_action('endgame-2026',$1,$2,'admit')",[token,organizer]),/CANCELLED/);const next=await reserve(["C06"]);assert.notEqual(next.tickets[0].token,token);});
  await t.test("QR inventado y enlace inexistente rechazados",async()=>{await assert.rejects(()=>rpc("public.cine_verify('endgame-2026',$1)",["f".repeat(64)]),/INVALID/);await assert.rejects(()=>rpc("public.cine_booking($1)",["f".repeat(64)]),/NOT_FOUND/);});
  await t.test("borrado definitivo exige admin y confirmación; incluye canceladas e invalida QR",async()=>{
    const b=await reserve(["E01","E02","E03","E04"]);
    await rpc("public.cine_ticket_action('endgame-2026',$1,$2,'admit')",[b.tickets[0].token,door]);await rpc("public.cine_ticket_action('endgame-2026',$1,$2,'cancel')",[b.tickets[1].token,organizer]);
    await assert.rejects(()=>remove("clear",null,"ELIMINAR TODO",door),/FORBIDDEN/);await assert.rejects(()=>remove("clear",null,"NO"),/CONFIRMATION/);
    await assert.rejects(()=>remove("delete",[],"ELIMINAR"),/INVALID/);await assert.rejects(()=>remove("delete",[b.tickets[0].id,b.tickets[0].id],"ELIMINAR"),/INVALID/);
    assert.equal((await rpc<Booking>("public.cine_booking($1)",[b.access_token])).tickets.length,4);
    // Si el motor falla a mitad del borrado, entradas y auditoría vuelven juntas.
    await pg.exec("create function public.qa_fail_delete() returns trigger language plpgsql as $$ begin if old.seat='E02' then raise exception 'QA_FAILURE'; end if; return old; end $$; create trigger qa_fail_delete before delete on public.cine_tickets for each row execute function public.qa_fail_delete();");
    await assert.rejects(()=>remove("delete",b.tickets.map(t=>t.id),"ELIMINAR"),/QA_FAILURE/);
    assert.equal((await rpc<Booking>("public.cine_booking($1)",[b.access_token])).tickets.length,4);
    assert.equal((await pg.query<{n:number}>("select count(*)::int n from public.cine_audit where ticket_id=any($1::uuid[])",[b.tickets.map(t=>t.id)])).rows[0].n,2);
    await pg.exec("drop trigger qa_fail_delete on public.cine_tickets; drop function public.qa_fail_delete();");
    const ids=b.tickets.slice(0,3).map(t=>t.id);await pg.exec("set role service_role;");assert.deepEqual(await remove("delete",ids,"ELIMINAR"),{deleted:3,reservationsDeleted:0});await pg.exec("reset role;");
    for(const ticket of b.tickets.slice(0,3))await assert.rejects(()=>rpc("public.cine_verify('endgame-2026',$1)",[ticket.token]),/INVALID/);
    assert.equal((await rpc<Booking>("public.cine_booking($1)",[b.access_token])).tickets[0].seat,"E04");
    assert.equal((await pg.query<{n:number}>("select count(*)::int n from public.cine_audit where ticket_id=any($1::uuid[])",[ids])).rows[0].n,0);
    assert.equal((await remove("delete",ids,"ELIMINAR")).deleted,0);
    assert.deepEqual(await remove("delete",[b.tickets[3].id],"ELIMINAR"),{deleted:1,reservationsDeleted:1});await assert.rejects(()=>rpc("public.cine_booking($1)",[b.access_token]),/NOT_FOUND/);
  });
  await t.test("pausa y rate limit persistentes",async()=>{await rpc("public.cine_set_open('endgame-2026',false,$1)",[organizer]);await assert.rejects(()=>reserve(["A01"]),/CLOSED/);await assert.rejects(()=>rpc("public.cine_set_open('endgame-2026',true,$1)",[door]),/FORBIDDEN/);await rpc("public.cine_rate_limit('qa',2,600)");await rpc("public.cine_rate_limit('qa',2,600)");await assert.rejects(()=>rpc("public.cine_rate_limit('qa',2,600)"),/RATE_LIMIT/);});
  await t.test("eliminar todas conserva pausa; restablecer retira cobros, ingresos y reservas y mantiene configuración y personal",async()=>{
    // Otra función no debe verse afectada por ninguno de los borrados.
    await pg.exec("insert into public.cine_events(id,title,starts_at,closes_at,venue,price,capacity,max_seats,booking_open) select 'otro-evento',title,starts_at,closes_at,venue,price,capacity,max_seats,booking_open from public.cine_events where id='endgame-2026';");
    const otherId=randomUUID();await pg.query("insert into public.cine_reservations(id,event_id,name,request_id,fingerprint) values ($1,'otro-evento','Otro evento',$2,'otro')",[otherId,randomUUID()]);
    await pg.query("insert into public.cine_tickets(reservation_id,event_id,seat,price) values ($1,'otro-evento','A01',5)",[otherId]);
    const before=await rpc<PublicState>("public.cine_public_state('endgame-2026')");assert.ok((await remove("clear",null,"ELIMINAR TODO")).deleted>0);
    assert.equal((await rpc<PublicState>("public.cine_public_state('endgame-2026')")).event.booking_open,false);
    await rpc("public.cine_set_open('endgame-2026',true,$1)",[organizer]);const b=await reserve(["F01","F02"]);
    await rpc("public.cine_ticket_action('endgame-2026',$1,$2,'admit')",[b.tickets[0].token,door]);await rpc("public.cine_set_open('endgame-2026',false,$1)",[organizer]);
    assert.deepEqual(await remove("reset",null,"REINICIAR"),{deleted:2,reservationsDeleted:1});
    const after=await rpc<PublicState>("public.cine_public_state('endgame-2026')");assert.deepEqual(after.occupied,[]);assert.deepEqual(after.event,{...before.event,booking_open:true});
    for(const table of ["cine_tickets","cine_reservations","cine_audit"])assert.equal((await pg.query<{n:number}>(`select count(*)::int n from public.${table} where event_id='endgame-2026'`)).rows[0].n,0);
    assert.equal((await pg.query<{n:number}>("select count(*)::int n from public.cine_staff")).rows[0].n,2);assert.equal((await pg.query<{n:number}>("select count(*)::int n from public.cine_tickets where event_id='otro-evento'")).rows[0].n,1);
    await assert.rejects(()=>rpc("public.cine_verify('endgame-2026',$1)",[b.tickets[0].token]),/INVALID/);await assert.rejects(()=>rpc("public.cine_booking($1)",[b.access_token]),/NOT_FOUND/);
    assert.equal((await remove("reset",null,"REINICIAR")).deleted,0);
  });
  await pg.close();
});
