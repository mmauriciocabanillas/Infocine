"use client";
import Link from "next/link";
import { useEffect,useRef,useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft,ArrowRight,CalendarDays,Clock3,MapPin,Ticket,LoaderCircle,ShieldCheck,RefreshCw } from "lucide-react";
import { api,message,ApiError } from "@/lib/client";
import { bookingIsOpen,EVENT_ID,money,reservationSchema,type PublicState } from "@/lib/domain";
import { Header,Footer,LocalNotice } from "./brand";
import { SeatMap } from "./seat-map";
export function ReservationForm(){
  const router=useRouter();const [state,setState]=useState<PublicState|null>(null),[selected,setSelected]=useState<string[]>([]),[name,setName]=useState(""),[accepted,setAccepted]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[connection,setConnection]=useState(""),[website,setWebsite]=useState("");
  const operation=useRef<{key:string;payload:string}|null>(null);
  async function refresh(){try{const next=await api<PublicState>("/api/event");setState(next);setConnection("");}catch(e){setConnection(message(e));}}
  useEffect(()=>{let active=true;async function poll(){try{const next=await api<PublicState>("/api/event");if(active){setState(next);setConnection("");}}catch(e){if(active)setConnection(message(e));}}void poll();const timer=setInterval(()=>{if(document.visibilityState==="visible")void poll();},5000);return()=>{active=false;clearInterval(timer);};},[]);
  function toggle(seat:string){setError("");operation.current=null;setSelected(current=>current.includes(seat)?current.filter(s=>s!==seat):[...current,seat].sort());}
  const open=state&&bookingIsOpen(state.event);
  async function submit(e:React.FormEvent){e.preventDefault();if(busy)return;setError("");
    const payload=JSON.stringify([name.trim(),selected]);
    if(!operation.current || operation.current.payload!==payload)operation.current={key:crypto.randomUUID(),payload};
    const input=reservationSchema.safeParse({eventId:EVENT_ID,name,seats:selected,requestId:operation.current.key,privacyAccepted:accepted,website});
    if(!input.success){setError(input.error.issues[0].message);return;}
    setBusy(true);
    try{const result=await api<{accessToken:string}>("/api/reservations",{method:"POST",body:input.data});router.push(`/entradas/${result.accessToken}`);}
    catch(e){setError(message(e));if(e instanceof ApiError && e.code==="CONFLICT"){operation.current=null;try{const next=await api<PublicState>("/api/event");setState(next);setSelected(current=>current.filter(s=>!next.occupied.includes(s)));}catch{}}setBusy(false);}
  }
  return <><Header active="reserva"/><LocalNotice mode={state?.mode}/><main id="contenido" className="booking-page"><Link href="/" className="back-link"><ArrowLeft size={15}/>Volver a la función</Link><div className="booking-heading"><div><p className="eyebrow">01 · TU LUGAR EN LA HISTORIA</p><h1>Elige tu butaca.</h1><p>La pantalla es grande. La elección es tuya.</p></div><div className="available-count"><span className="live-dot"/><b>{state?198-state.occupied.length:"—"}</b><span>de 198 disponibles</span></div></div>
    <div className="booking-layout"><section className="auditorium-panel" aria-label="Selección de butacas"><div className="panel-top"><span><Ticket size={17}/>AVENGERS: ENDGAME</span><span>VIE. 23 OCT · 4:30 P. M.</span></div>{!state?<div className="loading-state">{connection?<><p role="alert">{connection}</p><button className="button outline" onClick={refresh}>Reintentar <RefreshCw size={16}/></button></>:<><LoaderCircle className="spin"/>Cargando disponibilidad…</>}</div>:<SeatMap occupied={state.occupied} selected={selected} onToggle={toggle} disabled={busy||!open}/>}
      {connection&&state&&<p className="notice warning" role="status">No pudimos actualizar el plano. La disponibilidad se comprobará al confirmar.</p>}
      {state&&!open&&<p className="notice warning" role="status">Las reservas están cerradas para esta función.</p>}<p className="map-caption">Fila A: cerca de la pantalla · Fila K: parte posterior · Pasillo entre 09 y 10</p>
    </section><aside className="booking-summary"><form onSubmit={submit} noValidate><p className="eyebrow">TU RESERVA</p><h2>Una gran elección.</h2><div className="summary-event"><CalendarDays size={16}/><span>Viernes 23 de octubre de 2026</span><Clock3 size={16}/><span>4:30 p. m.</span><MapPin size={16}/><span>Auditorio de Ciencias Sociales</span></div>
      <label htmlFor="attendee">Nombre completo</label><input id="attendee" name="name" autoComplete="name" placeholder="¿A nombre de quién reservamos?" maxLength={100} value={name} onChange={e=>setName(e.target.value)} disabled={busy}/>
      <div className="honeypot" aria-hidden="true"><label>Sitio web<input tabIndex={-1} autoComplete="off" value={website} onChange={e=>setWebsite(e.target.value)}/></label></div>
      <div className="selected-heading"><span>Butacas elegidas</span><span>{selected.length}</span></div><div className="selected-seats" aria-live="polite">{selected.length?selected.map(s=><button type="button" disabled={busy} key={s} onClick={()=>toggle(s)} aria-label={`Quitar ${s}`}>{s} <span>×</span></button>):<p>Tu próxima escena empieza en el plano.</p>}</div>
      <div className="summary-total"><span>Total en puerta<small>{selected.length} entrada{selected.length!==1?"s":""} × S/ 5</small></span><b>{money(selected.length*(state?.event.price??5))}</b></div>
      <label className="checkbox-label"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)} disabled={busy}/><span>Acepto usar mi nombre para gestionar esta reserva. <Link href="/privacidad" target="_blank">Ver privacidad</Link></span></label>
      {error&&<p className="form-error" role="alert">{error}</p>}<button className="button gold full" type="submit" disabled={busy||!state||!open||selected.length===0}>{busy?<><LoaderCircle className="spin" size={18}/>Confirmando…</>:<>Confirmar reserva <ArrowRight size={18}/></>}</button><p className="secure-note"><ShieldCheck size={14}/>No pagarás nada ahora.</p>
    </form></aside></div></main><Footer/></>;
}
