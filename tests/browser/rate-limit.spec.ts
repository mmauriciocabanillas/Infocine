import { test,expect } from "@playwright/test";
import { clearQARateLimits } from "./qa";
test("Tres reservas HTTP con nombres distintos; la cuarta devuelve 429 y no ocupa asientos",async({request})=>{
  clearQARateLimits();
  for(let i=1;i<=3;i++){
    const response=await request.post("/api/reservations",{headers:{Origin:"http://127.0.0.1:3001","x-forwarded-for":`198.51.100.${i}`},data:{eventId:"endgame-2026",name:`Nombre diferente QA ${i}`,seats:[`K0${i}`],privacyAccepted:true,requestId:crypto.randomUUID()}});
    expect(response.status()).toBe(200);
  }
  for(let i=4;i<=5;i++){
    const response=await request.post("/api/reservations",{headers:{Origin:"http://127.0.0.1:3001","x-forwarded-for":`198.51.100.${i}`},data:{eventId:"endgame-2026",name:`Nombre diferente QA ${i}`,seats:[`K0${i}`],privacyAccepted:true,requestId:crypto.randomUUID()}});
    expect(response.status()).toBe(429);expect(response.headers()["retry-after"]).toBe("600");expect((await response.json()).code).toBe("RATE_LIMIT");
  }
  const state=await request.get("/api/event");expect(state.status()).toBe(200);const {occupied}=await state.json();expect(occupied).not.toContain("K04");expect(occupied).not.toContain("K05");
});
