import QRCode from "qrcode";
import type { Booking,Ticket } from "./domain";
export async function downloadTickets(booking:Booking,tickets:Ticket[]) {
  const {jsPDF}=await import("jspdf");
  const pdf=new jsPDF({unit:"mm",format:[100,180]});
  for(let i=0;i<tickets.length;i++){
    if(i)pdf.addPage([100,180]);const ticket=tickets[i];
    pdf.setFillColor(7,17,31);pdf.rect(0,0,100,180,"F");
    pdf.setTextColor(229,196,119);pdf.setFont("helvetica","bold");pdf.setFontSize(12);pdf.text("CINE CEFINF",50,15,{align:"center"});
    pdf.setTextColor(248,250,252);pdf.setFontSize(8);pdf.text("UNIVERSIDAD NACIONAL DE TRUJILLO",50,22,{align:"center"});pdf.setFontSize(18);pdf.text("AVENGERS",50,36,{align:"center"});pdf.setFontSize(10);pdf.text("E N D G A M E",50,43,{align:"center"});
    pdf.setFont("helvetica","normal");pdf.setFontSize(9);pdf.text("Viernes 23 de octubre de 2026",50,54,{align:"center"});pdf.text("4:30 p. m. · Auditorio de Ciencias Sociales",50,61,{align:"center"});
    pdf.setDrawColor(229,196,119);pdf.line(10,68,90,68);pdf.setFontSize(9);pdf.text("BUTACA",15,79);pdf.setFont("helvetica","bold");pdf.setFontSize(24);pdf.text(ticket.seat,15,90);
    pdf.setFontSize(8);pdf.text("A NOMBRE DE",48,78);pdf.setFont("helvetica","normal");pdf.setFontSize(10);pdf.text(pdf.splitTextToSize(booking.name,40).slice(0,3),48,85);
    const qr=await QRCode.toDataURL(`CINECEFINF:${ticket.token}`,{width:440,margin:4,errorCorrectionLevel:"M"});pdf.addImage(qr,"PNG",25,100,50,50);
    pdf.setTextColor(229,196,119);pdf.setFont("helvetica","bold");pdf.setFontSize(10);pdf.text(ticket.status==="cancelled"?"ENTRADA CANCELADA":ticket.admitted_at?"ENTRADA YA UTILIZADA":`S/ ${ticket.price.toFixed(2)} · PAGA AL INGRESAR`,50,158,{align:"center"});
    pdf.setTextColor(200,207,218);pdf.setFont("helvetica","normal");pdf.setFontSize(7);pdf.text("Una butaca. Un QR. Un solo ingreso.",50,166,{align:"center"});
    if(booking.mode==="local"){pdf.setTextColor(229,196,119);pdf.setFontSize(6);pdf.text("PRUEBA LOCAL - SIN VALIDEZ PARA EL EVENTO",50,174,{align:"center"});}
  }
  pdf.save(`Cine-CEFINF-${tickets.length===1?tickets[0].seat:"mis-entradas"}.pdf`);
}
