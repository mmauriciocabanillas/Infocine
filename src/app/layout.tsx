import type { Metadata } from "next";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-sans/latin-700.css";
import "@fontsource/barlow-condensed/latin-500.css";
import "@fontsource/barlow-condensed/latin-600.css";
import "@fontsource/barlow-condensed/latin-800.css";
import "./globals.css";
export const metadata: Metadata = { title:{default:"Cine CEFINF · Avengers: Endgame",template:"%s · Cine CEFINF"},description:"Reserva tu butaca para Cine CEFINF. Viernes 23 de octubre, 4:30 p. m. S/ 5 al ingresar al auditorio.",robots:{index:false,follow:false} };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="es-PE"><body><a className="skip-link" href="#contenido">Ir al contenido</a>{children}</body></html>; }
