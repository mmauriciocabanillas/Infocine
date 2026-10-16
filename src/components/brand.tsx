import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
export function Header({active=""}:{active?:string}) { return <header className="site-header"><div className="header-inner">
  <Link href="/" className="brand" aria-label="Cine CEFINF, inicio"><span className="brand-mark"><img src="/images/cefinf.jpg" alt="" width={44} height={32}/></span><span>CINE <b>CEFINF</b><small>INFORMÁTICA · UNT</small></span></Link>
  <nav aria-label="Navegación principal"><Link className={active==="funcion"?"active":""} href="/#funcion">La función</Link><Link className={active==="reserva"?"active":""} href="/reservar/endgame-2026">Reservar <ArrowUpRight size={14}/></Link></nav>
</div></header>; }
export function Footer() { return <footer className="site-footer"><span>Una función de <strong>CEFINF</strong> · Universidad Nacional de Trujillo</span><div><Link href="/privacidad">Privacidad</Link><Link href="/admin">Acceso del equipo <ArrowUpRight size={12}/></Link></div></footer>; }
export function LocalNotice({mode}:{mode?:string}) { return mode==="local"?<div className="local-notice">ENTORNO LOCAL DE PRUEBA · Estas reservas no pertenecen al evento real.</div>:null; }
