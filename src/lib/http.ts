import "server-only";
import { createHmac } from "node:crypto";
import { ZodError } from "zod";
import { AppError } from "./domain";
import { backend, store } from "./store";

export function json(data:unknown,status=200) { return Response.json(data,{status,headers:{"Cache-Control":"private, no-store","Vary":"Cookie"}}); }
export async function handle(request:Request, fn:()=>Promise<unknown>) {
  try {
    if(backend()==="local" && !["localhost","127.0.0.1","[::1]"].includes(new URL(request.url).hostname)) throw new AppError("LOCAL","El modo local solo está disponible en este equipo.",403);
    if(request.method!=="GET") {
      const origin=request.headers.get("origin");
      // Next puede normalizar request.url a localhost. Host conserva el destino real;
      // no usar x-forwarded-host, que un cliente puede falsificar.
      const host=request.headers.get("host");
      const protocol=process.env.VERCEL?"https:":new URL(request.url).protocol;
      if(!origin || !host || origin!==`${protocol}//${host}`) throw new AppError("ORIGIN","Origen de solicitud no válido.",403);
      if(!request.headers.get("content-type")?.startsWith("application/json")) throw new AppError("CONTENT","Solicitud no válida.",415);
      if(Number(request.headers.get("content-length")??0)>16384) throw new AppError("SIZE","Solicitud demasiado grande.",413);
    }
    return json(await fn());
  } catch(error) {
    if(error instanceof AppError) return json({error:error.message,code:error.code},error.status);
    if(error instanceof ZodError) return json({error:error.issues[0]?.message??"Revisa los datos.",code:"VALIDATION"},400);
    if(error instanceof SyntaxError) return json({error:"Datos no válidos.",code:"VALIDATION"},400);
    console.error("Cine request failed",error instanceof Error ? error.message : "unknown");
    return json({error:"El servicio no pudo completar la operación. Intenta nuevamente.",code:"SERVER"},503);
  }
}
export async function readBody(request:Request) {
  const reader=request.body?.getReader();
  if(!reader) throw new AppError("CONTENT","Solicitud vacía.",400);
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>16384){await reader.cancel();throw new AppError("SIZE","Solicitud demasiado grande.",413);}chunks.push(value);}
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export async function rateLimit(request:Request,bucket:string,limit:number,seconds:number) {
  // Vercel sobrescribe x-vercel-forwarded-for; no confiar en x-forwarded-for enviado por visitantes.
  const address=process.env.VERCEL ? request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ?? "unknown" : "loopback";
  const secret=process.env.RATE_LIMIT_SECRET;
  if(!secret || secret.length<32) throw new AppError("CONFIG","Falta configurar la protección de solicitudes.",503);
  const key=createHmac("sha256",secret).update(`${bucket}:${address}`).digest("hex");
  await store.rateLimit(key,limit,seconds);
}
