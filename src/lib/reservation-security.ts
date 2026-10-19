import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { AppError } from "./domain";

export const RESERVATION_ATTEMPTS = 3;
export const RESERVATION_WINDOW_SECONDS = 600;

export function clientAddress(request: Request, vercel = Boolean(process.env.VERCEL)) {
  if (!vercel) return "127.0.0.1";
  // Vercel establece esta cabecera. Nunca usar una IP enviada en el JSON o en X-Forwarded-For.
  const address = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (!address || !isIP(address)) throw new AppError("CLIENT_IP", "No pudimos verificar tu conexión. Intenta nuevamente.", 503);
  // Canonizar IPv6 evita cuotas separadas para distintas representaciones de la misma dirección.
  return isIP(address) === 6 ? new URL(`http://[${address}]/`).hostname.slice(1, -1) : address;
}

export function rateLimitKey(request: Request, bucket: string, secret: string | undefined, vercel = Boolean(process.env.VERCEL)) {
  if (!secret || secret.length < 32) throw new AppError("CONFIG", "Falta configurar la protección de solicitudes.", 503);
  return createHmac("sha256", secret).update(`${bucket}:${clientAddress(request, vercel)}`).digest("hex");
}

