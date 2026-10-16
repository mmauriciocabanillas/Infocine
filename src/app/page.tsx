import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Header, Footer } from "@/components/brand";
import { SNACK_OFFERS, SNACK_IMAGE } from "@/lib/presentation";

export default function Home() {
  return (
    <>
      <Header active="funcion" />
      <main id="contenido" className="cinema-home">
        <section className="cinema-hero" id="funcion" aria-labelledby="film-title">
          <div className="hero-topline"><span>CEFINF PRESENTA</span><span>TRUJILLO, PERÚ / 2026</span></div>
          <div className="cinema-portrait">
            <Image src="/images/tony-stark.jpg" alt="Tony Stark en Avengers: Endgame" fill sizes="(max-width: 600px) 100vw, 65vw" preload className="tony-portrait" />
          </div>
          <div className="cinema-hero-content">
            <p className="film-kicker">FUNCIÓN ESPECIAL</p>
            <h1 id="film-title"><span>AVENGERS</span>ENDGAME</h1>
            <p className="film-intro">La función de cine de Informática.<br />Reserva tu lugar en el auditorio.</p>
            <div className="film-actions">
              <Link className="button gold" href="/reservar/endgame-2026">Elegir mis butacas <ArrowUpRight size={19} /></Link>
              <a className="plain-link" href="#combos">Ver combos <ArrowRight size={16} /></a>
            </div>
            <p className="film-booking-note">Sin crear una cuenta. Un QR por butaca.</p>
          </div>
          <dl className="function-details">
            <div className="function-date"><dt>VIERNES</dt><dd><time dateTime="2026-10-23">23 OCT<span>2026</span></time></dd></div>
            <div><dt>LA FUNCIÓN</dt><dd>4:30 p. m.<span>Hora de Lima</span></dd></div>
            <div className="function-venue"><dt>NOS ENCONTRAMOS EN</dt><dd>Auditorio de<br />Ciencias Sociales<span>Universidad Nacional de Trujillo</span></dd></div>
            <div><dt>POR ENTRADA</dt><dd>S/ 5<span>Pago al ingresar</span></dd></div>
          </dl>
        </section>
        <section className="booking-guide" aria-labelledby="guide-title">
          <figure className="guide-artwork">
            <Image src="/images/endgame-symbol.jpg" alt="Símbolo de Avengers: Endgame en blanco y negro" width={1688} height={2500} sizes="(max-width: 600px) 280px, 358px" />
            <figcaption>AVENGERS: ENDGAME / INFOCINE</figcaption>
          </figure>
          <div className="guide-copy">
            <p className="section-label">ANTES DE LA FUNCIÓN</p>
            <h2 id="guide-title">TU ENTRADA,<br />EN TRES PASOS.</h2>
            <ol className="reservation-steps">
              <li><span>01</span><div><h3>Elige tus butacas</h3><p>Escribe tu nombre y selecciona asientos en el plano de 198 butacas.</p></div></li>
              <li><span>02</span><div><h3>Guarda tus QR</h3><p>Cada asiento tiene su propia entrada. Descarga el PDF o conserva tu enlace privado.</p></div></li>
              <li><span>03</span><div><h3>Paga en la puerta</h3><p>Presenta un QR por persona y paga S/ 5 por entrada al ingresar.</p></div></li>
            </ol>
            <Link className="plain-link" href="/reservar/endgame-2026">Ir al plano del auditorio <ArrowUpRight size={17} /></Link>
          </div>
        </section>
        <section className="snacks-section" id="combos" aria-labelledby="snacks-title">
          <div className="snacks-inner">
            <div className="snacks-heading"><p className="section-label">COMBOS Y PROMOCIONES</p><h2 id="snacks-title">CANCHITA<br />Y GASEOSA.</h2><p>Elige tu combo al llegar.<br />Venta presencial en el auditorio.</p></div>
            <div className="snacks-layout">
              <div className="snack-art">
                <Image src={SNACK_IMAGE} alt="Canchita y una botella de Inca Kola" width={1180} height={1333} sizes="(max-width: 760px) 90vw, 35vw" />
              </div>
              <div className="snacks-menu">
                <div className="snacks-menu-heading"><span>EL COMBO</span><span>PRECIO</span></div>
                <ul className="snack-offers">{SNACK_OFFERS.map(offer => <li key={offer.name}><div><h3>{offer.name}</h3><p>{offer.includes}</p></div><div className="snack-offer-price">{offer.regular && <del>{offer.regular}</del>}<strong>{offer.price}</strong></div></li>)}</ul>
                <p className="snacks-note">La web reserva butacas. Los combos se eligen y pagan en el auditorio.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
