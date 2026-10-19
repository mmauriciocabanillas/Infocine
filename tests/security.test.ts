import { test } from "node:test";
import assert from "node:assert/strict";
import { clientAddress, rateLimitKey, RESERVATION_ATTEMPTS, RESERVATION_WINDOW_SECONDS } from "../src/lib/reservation-security";
import { LocalStore } from "../src/lib/local-store";
const secret="qa-secret-with-more-than-thirty-two-characters";
const request=(ip:string,name="Otro nombre",spoof="198.51.100.8")=>new Request("https://infocine-seven.vercel.app/api/reservations",{method:"POST",headers:{"x-vercel-forwarded-for":ip,"x-forwarded-for":spoof},body:JSON.stringify({name})});
test("Tres intentos por IP aunque cambien nombre o X-Forwarded-For; otra IP tiene su cuota",()=>{
  const db=new LocalStore(":memory:");try{
    const first=rateLimitKey(request("203.0.113.10"),"reserve",secret,true);
    for(let i=0;i<3;i++){const key=rateLimitKey(request("203.0.113.10",`Nombre ${i}`,`198.51.100.${i}`),"reserve",secret,true);assert.equal(key,first);db.rateLimit(key,RESERVATION_ATTEMPTS,RESERVATION_WINDOW_SECONDS);}
    assert.throws(()=>db.rateLimit(first,RESERVATION_ATTEMPTS,RESERVATION_WINDOW_SECONDS),/Demasiados/);
    const other=rateLimitKey(request("203.0.113.11"),"reserve",secret,true);assert.notEqual(first,other);db.rateLimit(other,3,600);
    db.db.prepare("UPDATE rate_limits SET resets_at=0 WHERE key=?").run(first);db.rateLimit(first,3,600);
    assert.notEqual(first,rateLimitKey(request("203.0.113.10"),"login",secret,true));
  }finally{db.close();}
});
test("IP validada y normalizada; no acepta cabeceras arbitrarias ni revela la IP en la clave",()=>{
  assert.equal(clientAddress(request("2001:0db8:0000:0000:0000:0000:0000:0001"),true),"2001:db8::1");
  assert.equal(rateLimitKey(request("2001:db8::1"),"reserve",secret,true),rateLimitKey(request("2001:0db8:0:0:0:0:0:1"),"reserve",secret,true));
  assert.throws(()=>clientAddress(new Request("https://example.com",{headers:{"x-forwarded-for":"203.0.113.10"}}),true),/verificar tu conexión/);
  assert.throws(()=>clientAddress(request("inventada"),true),/verificar tu conexión/);
  assert.equal(clientAddress(request("inventada"),false),"127.0.0.1");
  assert.match(rateLimitKey(request("203.0.113.10"),"reserve",secret,true),/^[a-f0-9]{64}$/);
  assert.throws(()=>rateLimitKey(request("203.0.113.10"),"reserve","",true),/configurar/);
});
