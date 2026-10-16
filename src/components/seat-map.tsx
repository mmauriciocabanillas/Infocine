"use client";
import { Check, X } from "lucide-react";
import { ROWS } from "@/lib/domain";
import { CinemaSeat } from "./cinema-seat";
export function SeatMap({occupied,selected,onToggle,disabled=false}:{occupied:string[];selected:string[];onToggle:(seat:string)=>void;disabled?:boolean}) {
  const taken=new Set(occupied), chosen=new Set(selected);
  return <div className="seat-map"><div className="screen"><span>PANTALLA</span></div><div className="block-labels"><span>BLOQUE IZQUIERDO</span><span>BLOQUE DERECHO</span></div>
    <div className="seat-scroll" tabIndex={0} aria-label="Plano del auditorio. Desplaza horizontalmente para ver ambos bloques."><div className="seat-rows">
      {ROWS.map(row=><div className="seat-row" key={row}><span className="row-label">{row}</span>{Array.from({length:18},(_,i)=>{
        const seat=`${row}${String(i+1).padStart(2,"0")}`,isTaken=taken.has(seat),isChosen=chosen.has(seat);
        return <button type="button" key={seat} className={`seat ${i===9?"after-aisle":""} ${isTaken?"taken":""} ${isChosen?"chosen":""}`} disabled={disabled||isTaken} aria-label={`Butaca ${seat}, ${isTaken?"ocupada":isChosen?"seleccionada":"disponible"}`} aria-pressed={isChosen} onClick={()=>onToggle(seat)} title={seat}>
          <CinemaSeat/><span className="seat-number">{String(i+1).padStart(2,"0")}</span>{isChosen&&<Check className="selection-mark" size={10}/>} {isTaken&&<X className="occupied-mark" size={10}/>}</button>;
      })}<span className="row-label">{row}</span></div>)}
    </div></div><div className="seat-legend"><span><i className="free-key"/>Disponible</span><span><i className="chosen-key"/>Tu selección</span><span><i className="taken-key"/>Ocupada</span><span className="scroll-hint">↔ Desliza para ver toda la sala</span></div></div>;
}
