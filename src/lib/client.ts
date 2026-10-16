export class ApiError extends Error { constructor(message:string,public status:number,public code:string){super(message);} }
export async function api<T>(path:string,options?:{method?:string;body?:unknown}):Promise<T> {
  const response=await fetch(path,{method:options?.method??"GET",headers:options?.body!==undefined?{"Content-Type":"application/json"}:undefined,body:options?.body!==undefined?JSON.stringify(options.body):undefined,cache:"no-store"});
  const data=await response.json();
  if(!response.ok) throw new ApiError(data.error??"No se pudo completar la operación.",response.status,data.code??"SERVER");
  return data;
}
export function message(error:unknown) { return error instanceof Error ? error.message : "No pudimos conectar. Revisa tu conexión e intenta nuevamente."; }
// Los QR de la marca anterior conservan el mismo token de entrada.
export function parseQR(value:string) { const clean=value.trim().replace(/^(?:INFOCINE|CINECEFINF):/i,"");if(!/^[a-f0-9]{64}$/.test(clean)) throw new Error("El código no es una entrada de INFOCINE.");return clean; }
