import Link from "next/link";
import { Header,Footer } from "@/components/brand";
export default function NotFound(){return <><Header/><main className="text-page" id="contenido"><p className="eyebrow">404</p><h1>Página no encontrada</h1><p>El enlace no existe o está incompleto.</p><Link href="/" className="button gold">Volver a la función</Link></main><Footer/></>;}
