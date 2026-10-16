import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError, type Staff } from "./domain";
import { backend, supabaseAdmin, supabaseAuth } from "./store";

const COOKIE = "cine_session";
const REFRESH = "cine_refresh";
const cookieOptions = () => ({ httpOnly:true, secure:backend()==="supabase" && process.env.NODE_ENV==="production", sameSite:"strict" as const, path:"/", maxAge:3600 });
function signature(text:string) {
  const secret=process.env.SESSION_SECRET;
  if(!secret || secret.length<32) throw new AppError("CONFIG","Falta configurar la sesión local.",503);
  return createHmac("sha256",secret).update(text).digest("hex");
}
function equal(a:string,b:string) { const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length && timingSafeEqual(x,y); }
export async function signIn(email:string,password:string) {
  const jar=await cookies();
  if(backend()==="local") {
    const expected=process.env.LOCAL_ADMIN_PASSWORD;
    if(!expected || !equal(password,expected)) throw new AppError("AUTH","Credenciales incorrectas.",401);
    const payload=Buffer.from(JSON.stringify({exp:Date.now()+3600000})).toString("base64url");
    jar.set(COOKIE,`${payload}.${signature(payload)}`,cookieOptions());
    return {id:"local-organizer",role:"admin" as const};
  }
  const {data,error}=await supabaseAuth().auth.signInWithPassword({email,password});
  if(error || !data.session) throw new AppError("AUTH","Credenciales incorrectas.",401);
  const staff=await staffRole(data.user.id);
  jar.set(COOKIE,data.session.access_token,cookieOptions());
  jar.set(REFRESH,data.session.refresh_token,{...cookieOptions(),maxAge:7*86400});
  return staff;
}
async function staffRole(id:string):Promise<Staff> {
  const {data,error}=await supabaseAdmin().from("cine_staff").select("role").eq("user_id",id).single();
  if(error || !data || !["admin","door"].includes(data.role)) throw new AppError("FORBIDDEN","Esta cuenta no tiene acceso al equipo de Cine CEFINF.",403);
  return {id,role:data.role};
}
export async function requireStaff(adminOnly=false):Promise<Staff> {
  const jar=await cookies();const token=jar.get(COOKIE)?.value;
  if(!token && (backend()==="local" || !jar.get(REFRESH)?.value)) throw new AppError("AUTH","Inicia sesión para continuar.",401);
  let staff:Staff;
  if(backend()==="local") {
    const [payload,sig]=token!.split(".");
    if(!payload || !sig || !equal(signature(payload),sig)) throw new AppError("AUTH","Tu sesión venció. Inicia sesión.",401);
    try { if(JSON.parse(Buffer.from(payload,"base64url").toString()).exp<Date.now()) throw new Error(); }
    catch { throw new AppError("AUTH","Tu sesión venció. Inicia sesión.",401); }
    staff={id:"local-organizer",role:"admin"};
  } else {
    const auth=supabaseAuth();let result=await auth.auth.getUser(token??"");
    if(result.error && jar.get(REFRESH)?.value) {
      const refreshed=await auth.auth.refreshSession({refresh_token:jar.get(REFRESH)!.value});
      if(!refreshed.error && refreshed.data.session) {
        jar.set(COOKIE,refreshed.data.session.access_token,cookieOptions());
        jar.set(REFRESH,refreshed.data.session.refresh_token,{...cookieOptions(),maxAge:7*86400});
        result=await auth.auth.getUser(refreshed.data.session.access_token);
      }
    }
    if(result.error || !result.data.user) throw new AppError("AUTH","Tu sesión venció. Inicia sesión.",401);
    staff=await staffRole(result.data.user.id);
  }
  if(adminOnly && staff.role!=="admin") throw new AppError("FORBIDDEN","Esta acción requiere un administrador.",403);
  return staff;
}
export async function signOut() {
  const jar=await cookies();
  if(backend()==="supabase") {
    const token=jar.get(COOKIE)?.value;
    if(token) await supabaseAdmin().auth.admin.signOut(token,"local");
  }
  jar.delete(COOKIE);jar.delete(REFRESH);
}
