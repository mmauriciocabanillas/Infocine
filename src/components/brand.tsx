import Link from "next/link";
import { ArrowUpRight, Facebook, Instagram } from "lucide-react";
import { SOCIAL_LINKS } from "@/lib/presentation";

export function Header({ active = "" }: { active?: string }) {
  return <header className="site-header"><div className="header-inner">
    <Link href="/" className="brand" aria-label="INFOCINE, inicio"><img src="/brand/infocine.svg" alt="" width={48} height={48} /><span>INFOCINE</span></Link>
    <nav aria-label="Navegación principal"><Link className={active === "funcion" ? "active" : ""} href="/#funcion">La función</Link><Link href="/#combos">Combos</Link><Link className={"nav-reserve " + (active === "reserva" ? "active" : "")} href="/reservar/endgame-2026">Reservar <ArrowUpRight size={15} /></Link></nav>
  </div></header>;
}

export function Footer() {
  return <footer className="site-footer"><div className="footer-top">
    <div className="footer-identity"><Link href="/" className="footer-brand" aria-label="INFOCINE, inicio"><img src="/brand/infocine.svg" alt="" width={54} height={54} /><span>INFOCINE</span></Link><p>Organiza el Centro Federado de Informática.<br />Universidad Nacional de Trujillo.</p></div>
    <div className="footer-socials"><h2>Sigue al centro federado</h2><a href={SOCIAL_LINKS.instagram} target="_blank" rel="noopener noreferrer"><Instagram size={19} /><span>Instagram <small>@cefinf.unt</small></span><ArrowUpRight size={17} /></a><a href={SOCIAL_LINKS.facebook} target="_blank" rel="noopener noreferrer"><Facebook size={19} /><span>Facebook <small>CEFINF</small></span><ArrowUpRight size={17} /></a></div>
  </div><div className="footer-bottom"><span>INFOCINE / 2026</span><div><Link href="/privacidad">Privacidad</Link><Link href="/admin">Administración <ArrowUpRight size={12} /></Link></div></div></footer>;
}
