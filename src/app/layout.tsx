import type { Metadata } from "next";
import "@fontsource/anton/latin-400.css";
import "@fontsource/public-sans/latin-400.css";
import "@fontsource/public-sans/latin-500.css";
import "@fontsource/public-sans/latin-600.css";
import "@fontsource/public-sans/latin-700.css";
import "./globals.css";
import "./infocine.css";

export const metadata: Metadata = {
  title: { default: "INFOCINE · Avengers: Endgame", template: "%s · INFOCINE" },
  description: "Reserva tu butaca en INFOCINE. Viernes 23 de octubre, 4:30 p. m. Auditorio de Ciencias Sociales, UNT. S/ 5 al ingresar.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="es-PE"><body><a className="skip-link" href="#contenido">Ir al contenido</a>{children}</body></html>;
}
