import QRCode from "qrcode";
import type { Booking,Ticket } from "./domain";
export async function downloadTickets(booking:Booking,tickets:Ticket[]) {
  const {jsPDF}=await import("jspdf");
  const pdf=new jsPDF({unit:"mm",format:[100,180]});
  let logo:string|null=null;
  try {
    const image=new window.Image();image.src="/brand/infocine.svg";await image.decode();
    const canvas=document.createElement("canvas");canvas.width=128;canvas.height=128;
    const context=canvas.getContext("2d");if(context){context.drawImage(image,0,0,128,128);logo=canvas.toDataURL("image/png");}
  } catch { /* El QR sigue disponible si no se pudo cargar la imagen de marca. */ }
  for(let i=0;i<tickets.length;i++){
    if(i)pdf.addPage([100,180]);const ticket=tickets[i];
    pdf.setFillColor(12,12,11);pdf.rect(0,0,100,180,"F");
    if(logo)pdf.addImage(logo,"PNG",12,8,11,11);
    pdf.setTextColor(251,241,219);pdf.setFont("helvetica","bold");pdf.setFontSize(12);pdf.text("INFOCINE",50,15,{align:"center"});
    pdf.setTextColor(251,241,219);pdf.setFontSize(8);pdf.text("UNIVERSIDAD NACIONAL DE TRUJILLO",50,22,{align:"center"});pdf.setFontSize(18);pdf.text("AVENGERS",50,36,{align:"center"});pdf.setFontSize(10);pdf.text("E N D G A M E",50,43,{align:"center"});
    pdf.setFont("helvetica","normal");pdf.setFontSize(9);pdf.text("Viernes 23 de octubre de 2026",50,54,{align:"center"});pdf.text("4:30 p. m. · Auditorio de Ciencias Sociales",50,61,{align:"center"});
    pdf.setDrawColor(181,172,151);pdf.line(10,68,90,68);pdf.setFontSize(9);pdf.text("BUTACA",15,79);pdf.setFont("helvetica","bold");pdf.setFontSize(24);pdf.text(ticket.seat,15,90);
    pdf.setFontSize(8);pdf.text("A NOMBRE DE",48,78);pdf.setFont("helvetica","normal");pdf.setFontSize(10);pdf.text(pdf.splitTextToSize(booking.name,40).slice(0,3),48,85);
    const qr=await QRCode.toDataURL(`INFOCINE:${ticket.token}`,{width:440,margin:4,errorCorrectionLevel:"M"});pdf.addImage(qr,"PNG",25,100,50,50);
    pdf.setTextColor(251,241,219);pdf.setFont("helvetica","bold");pdf.setFontSize(10);pdf.text(ticket.status==="cancelled"?"ENTRADA CANCELADA":ticket.admitted_at?"ENTRADA YA UTILIZADA":`S/ ${ticket.price.toFixed(2)} · PAGA AL INGRESAR`,50,158,{align:"center"});
    pdf.setTextColor(195,185,163);pdf.setFont("helvetica","normal");pdf.setFontSize(7);pdf.text("Una butaca. Un QR. Un solo ingreso.",50,166,{align:"center"});
  }
  pdf.save(`INFOCINE-${tickets.length===1?tickets[0].seat:"mis-entradas"}.pdf`);
}
