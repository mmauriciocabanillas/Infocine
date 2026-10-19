import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { LocalStore,fingerprintFor } from "../src/lib/local-store";
import { EVENT_ID,SEATS,reservationSchema,type ReserveInput } from "../src/lib/domain";
function input(seats:string[],name="Asistente de prueba"):ReserveInput{return {eventId:EVENT_ID,name,seats,requestId:randomUUID(),privacyAccepted:true};}
test("Plano: 198 asientos distintos, A01–K18, y nombres/asientos inválidos rechazados",()=>{
  assert.equal(SEATS.length,198);assert.equal(new Set(SEATS).size,198);assert.equal(SEATS[0],"A01");assert.equal(SEATS.at(-1),"K18");
  for(const data of [{...input(["A01"]),name:" "},input(["A01","A01"]),input(["A19"]),{...input(["A01"]),privacyAccepted:false}])assert.equal(reservationSchema.safeParse(data).success,false);
});
test("Reserva multi-butaca: un QR por asiento, sin pago ni ingreso anticipado",()=>{
  const db=new LocalStore(":memory:");try{const i=input(["C05","C06","C07"]);const b=db.reserve(i,fingerprintFor(i));assert.equal(b.tickets.length,3);assert.equal(new Set(b.tickets.map(t=>t.token)).size,3);assert.equal(b.tickets.every(t=>!t.paid_at&&!t.admitted_at),true);assert.equal(db.occupied().length,3);assert.deepEqual(db.booking(b.access_token),b);}finally{db.close();}
});
test("Conflicto revierte toda la reserva y no ocupa las butacas todavía libres",()=>{
  const db=new LocalStore(":memory:");try{const a=input(["D08"]);db.reserve(a,fingerprintFor(a));const b=input(["D07","D08"]);assert.throws(()=>db.reserve(b,fingerprintFor(b)),/Alguien acaba/);assert.deepEqual(db.occupied(),["D08"]);assert.equal(db.dashboard().length,1);}finally{db.close();}
});
test("Reintentos idempotentes devuelven los mismos QR, incluso al pausar reservas",()=>{
  const db=new LocalStore(":memory:");try{const i=input(["E01","E02"]),f=fingerprintFor(i),b=db.reserve(i,f);db.setOpen(false);assert.deepEqual(db.reserve(i,f),bWithClosedEvent(b));const changed={...i,seats:["E03"]};assert.throws(()=>db.reserve(changed,fingerprintFor(changed)),/operación cambió/);assert.equal(db.dashboard().length,2);}finally{db.close();}
});
function bWithClosedEvent(b:ReturnType<LocalStore["reserve"]>){return {...b,event:{...b.event,booking_open:false}};}
test("Ingreso cobra y admite una sola vez, cancelación libera sin reutilizar el QR anterior",()=>{
  const db=new LocalStore(":memory:");try{const i=input(["F01","F02"]),b=db.reserve(i,fingerprintFor(i)),[a,c]=b.tickets;const admitted=db.mutate(a.token,"organizador-qa","admit");assert.ok(admitted.paid_at);assert.equal(admitted.admitted_by,"organizador-qa");assert.throws(()=>db.mutate(a.token,"otro","admit"),/ya fue utilizada/);assert.throws(()=>db.mutate(a.token,"otro","cancel"),/ya fue utilizada/);db.mutate(c.token,"organizador-qa","cancel");assert.equal(db.occupied().length,1);assert.throws(()=>db.mutate(c.token,"organizador-qa","admit"),/cancelada/);const next=input(["F02"]);assert.notEqual(db.reserve(next,fingerprintFor(next)).tickets[0].token,c.token);assert.throws(()=>db.verify("f".repeat(64)),/QR no válido/);}finally{db.close();}
});
test("Máximo cuatro por nombre, incluso en varias reservas; admite tildes y espacios equivalentes",()=>{
  const db=new LocalStore(":memory:");try{
    const oversized=input(SEATS.slice(0,5));assert.equal(reservationSchema.safeParse(oversized).success,false);assert.throws(()=>db.reserve(oversized,fingerprintFor(oversized)),/máximo de 4/);assert.equal(db.dashboard().length,0);
    const first=input(["A01","A02"],"José  Muñoz"),a=db.reserve(first,fingerprintFor(first));
    const second=input(["A03","A04"]," JOSE MUNOZ "),b=db.reserve(second,fingerprintFor(second));
    assert.deepEqual(db.reserve(second,fingerprintFor(second)),b);
    const fifth=input(["A05"],"jose muñoz");assert.throws(()=>db.reserve(fifth,fingerprintFor(fifth)),/4 butacas en total/);
    db.mutate(a.tickets[0].token,"qa","admit");assert.throws(()=>db.reserve(fifth,fingerprintFor(fifth)),/4 butacas en total/);
    db.mutate(a.tickets[1].token,"qa","cancel");assert.equal(db.reserve(fifth,fingerprintFor(fifth)).tickets.length,1);assert.equal(db.occupied().length,4);
    const other=input(["B01"],"Otra persona");assert.equal(db.reserve(other,fingerprintFor(other)).tickets.length,1);
  }finally{db.close();}
});
test("Borrado permanente de pagadas, canceladas y reservadas; conserva los tickets no elegidos",()=>{
  const db=new LocalStore(":memory:");try{
    const i=input(["C01","C02","C03","C04"]),b=db.reserve(i,fingerprintFor(i));
    db.mutate(b.tickets[0].token,"qa","admit");db.mutate(b.tickets[1].token,"qa","cancel");
    const ids=b.tickets.slice(0,3).map(t=>t.id);
    assert.deepEqual(db.deleteTickets({action:"delete",ids,confirmation:"ELIMINAR"}),{deleted:3,reservationsDeleted:0});
    assert.deepEqual(db.occupied(),["C04"]);assert.equal(db.booking(b.access_token).tickets.length,1);assert.equal(db.db.prepare("SELECT count(*) AS n FROM audit").get()?.n,0);
    for(const ticket of b.tickets.slice(0,3))assert.throws(()=>db.verify(ticket.token),/QR no válido/);
    assert.equal(db.deleteTickets({action:"delete",ids,confirmation:"ELIMINAR"}).deleted,0);
    assert.deepEqual(db.deleteTickets({action:"delete",ids:[b.tickets[3].id],confirmation:"ELIMINAR"}),{deleted:1,reservationsDeleted:1});
    assert.throws(()=>db.booking(b.access_token),/No encontramos/);assert.equal(db.dashboard().length,0);
  }finally{db.close();}
});
test("Borrado es atómico, exige confirmación y restablecer libera todo sin cambiar fecha ni precio",()=>{
  const db=new LocalStore(":memory:");try{
    const i=input(["E01","E02"]),b=db.reserve(i,fingerprintFor(i));db.mutate(b.tickets[0].token,"qa","admit");
    assert.throws(()=>db.deleteTickets({action:"clear",confirmation:"NO"} as never));assert.equal(db.dashboard().length,2);
    db.db.exec("CREATE TRIGGER fail_delete BEFORE DELETE ON tickets WHEN OLD.seat='E02' BEGIN SELECT RAISE(ABORT,'qa failure'); END;");
    assert.throws(()=>db.deleteTickets({action:"clear",confirmation:"ELIMINAR TODO"}),/qa failure/);
    assert.equal(db.dashboard().length,2);assert.equal(db.db.prepare("SELECT count(*) AS n FROM audit").get()?.n,1);
    db.db.exec("DROP TRIGGER fail_delete");db.setOpen(false);const previous=db.event();
    assert.deepEqual(db.deleteTickets({action:"clear",confirmation:"ELIMINAR TODO"}),{deleted:2,reservationsDeleted:1});assert.equal(db.event().booking_open,false);
    db.setOpen(true);const next=input(["F03","F04"]),fresh=db.reserve(next,fingerprintFor(next));db.mutate(fresh.tickets[0].token,"qa","admit");db.setOpen(false);
    assert.deepEqual(db.deleteTickets({action:"reset",confirmation:"REINICIAR"}),{deleted:2,reservationsDeleted:1});
    assert.deepEqual(db.event(),{...previous,booking_open:true});assert.deepEqual(db.occupied(),[]);assert.equal(db.dashboard().length,0);
    assert.equal(db.db.prepare("SELECT count(*) AS n FROM reservations").get()?.n,0);assert.equal(db.db.prepare("SELECT count(*) AS n FROM audit").get()?.n,0);
    assert.throws(()=>db.booking(fresh.access_token),/No encontramos/);assert.equal(db.deleteTickets({action:"reset",confirmation:"REINICIAR"}).deleted,0);
  }finally{db.close();}
});
test("Pausa, cierre por horario y limitador se verifican en servidor",()=>{
  const db=new LocalStore(":memory:");try{db.setOpen(false);const i=input(["G01"]);assert.throws(()=>db.reserve(i,fingerprintFor(i)),/cerradas/);db.rateLimit("qa",2,600);db.rateLimit("qa",2,600);assert.throws(()=>db.rateLimit("qa",2,600),/Demasiados/);db.setOpen(true);const e=db.event();db.db.prepare("UPDATE events SET data=? WHERE id=?").run(JSON.stringify({...e,closes_at:"2000-01-01T00:00:00Z"}),e.id);assert.throws(()=>db.reserve(i,fingerprintFor(i)),/cerradas/);}finally{db.close();}
});
