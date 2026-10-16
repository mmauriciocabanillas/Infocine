import { test,expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import QRCode from "qrcode";
const password=readFileSync(".env.local","utf8").match(/^LOCAL_ADMIN_PASSWORD=(.+)$/m)?.[1]?.trim();
const origin="http://127.0.0.1:3001";
test("Reserva, QR individual, PDF, control de puerta y cancelación",async({page,request})=>{
  const anonymous=await request.get("/api/admin/dashboard");expect(anonymous.status()).toBe(401);
  const fake=await request.post("/api/admin/ticket",{headers:{Origin:origin},data:{token:"f".repeat(64),action:"admit"}});expect(fake.status()).toBe(401);
  await page.goto("/");await expect(page.getByRole("heading",{name:"AVENGERS ENDGAME",exact:true})).toBeVisible();
  await page.screenshot({path:"test-results/inicio-desktop.png",fullPage:true});
  await page.getByRole("link",{name:"Elegir mis butacas"}).click();
  await expect(page.getByRole("button",{name:/Butaca A01, disponible/})).toBeEnabled();
  await expect(page.getByRole("button",{name:/Butaca .* (disponible|ocupada|seleccionada)/})).toHaveCount(198);
  await page.getByLabel("Nombre completo").fill("Asistente QA navegador");
  await page.getByRole("button",{name:"Butaca A01, disponible",exact:true}).click();await page.getByRole("button",{name:"Butaca A02, disponible",exact:true}).click();
  await page.getByRole("checkbox").check();await page.getByRole("button",{name:"Confirmar reserva",exact:true}).click();
  await expect(page).toHaveURL(/\/entradas\/[a-f0-9]{64}$/);const access=page.url().split("/").at(-1)!;
  await expect(page.getByRole("img",{name:/QR de entrada para la butaca/})).toHaveCount(2);
  const booking=await (await request.get(`/api/entries/${access}`)).json();expect(booking.tickets[0].token).not.toBe(booking.tickets[1].token);expect(booking.tickets[0].paid_at).toBeNull();
  const qrSource=await page.getByRole("img",{name:"QR de entrada para la butaca A01",exact:true}).getAttribute("src");const qrBuffer=Buffer.from(qrSource!.split(",")[1],"base64");
  const downloadPromise=page.waitForEvent("download");await page.getByRole("button",{name:"Descargar todas las entradas"}).click();const download=await downloadPromise;expect(download.suggestedFilename()).toMatch(/\.pdf$/);await download.saveAs("test-results/entradas-qa.pdf");
  await page.screenshot({path:"test-results/entradas-desktop.png",fullPage:true});
  await page.goto("/admin");await page.getByLabel("Contraseña",{exact:true}).fill(password!);await page.getByRole("button",{name:"Ingresar al equipo"}).click();await expect(page.getByRole("heading",{name:"Todo listo para la función."})).toBeVisible();
  await page.getByRole("link",{name:"Control de puerta"}).click();await page.locator('input[type="file"]').setInputFiles({name:"entrada-A01.png",mimeType:"image/png",buffer:qrBuffer});await expect(page.getByRole("heading",{name:"A01",exact:true})).toBeVisible();
  await page.getByRole("checkbox").check();await page.getByRole("button",{name:"Confirmar pago e ingreso"}).click();await expect(page.getByRole("status")).toContainText("Ingreso registrado: A01");
  const reused=await page.request.post("/api/admin/ticket",{headers:{Origin:origin},data:{token:booking.tickets[0].token,action:"admit"}});expect(reused.status()).toBe(409);
  const cancelled=await page.request.post("/api/admin/ticket",{headers:{Origin:origin},data:{token:booking.tickets[1].token,action:"cancel"}});expect(cancelled.ok()).toBeTruthy();
  const state=await (await request.get("/api/event")).json();expect(state.occupied).toContain("A01");expect(state.occupied).not.toContain("A02");expect(JSON.stringify(state)).not.toContain("Asistente QA");
  await page.screenshot({path:"test-results/puerta-desktop.png",fullPage:true});
});
test("Confirmaciones HTTP simultáneas y reintento idempotente",async({request})=>{
  const body={eventId:"endgame-2026",name:"Concurrencia QA",seats:["B01","B02"],privacyAccepted:true,requestId:crypto.randomUUID()};
  const bodies=[body,{...body,requestId:crypto.randomUUID()}];
  const results=await Promise.all(bodies.map(data=>request.post("/api/reservations",{headers:{Origin:origin},data})));
  expect(results.map(r=>r.status()).sort()).toEqual([200,409]);const win=results.find(r=>r.status()===200)!;const token=(await win.json()).accessToken;
  const again=await request.post("/api/reservations",{headers:{Origin:origin},data:bodies[results.findIndex(r=>r.status()===200)]});
  expect(again.status()).toBe(200);expect((await again.json()).accessToken).toBe(token);
  const denied=await request.post("/api/reservations",{headers:{Origin:"https://ejemplo-ajeno.invalid"},data:{...body,seats:["B03"],requestId:crypto.randomUUID()}});expect(denied.status()).toBe(403);
});
test("Móvil: sin desbordamiento de página, plano desplazable y 198 controles",async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto("/");await page.screenshot({path:"test-results/inicio-mobile.png",fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
  await page.goto("/reservar/endgame-2026");await expect(page.getByRole("button",{name:/Butaca K18/})).toHaveCount(1);expect(await page.locator(".seat-scroll").evaluate(el=>el.scrollWidth>el.clientWidth)).toBeTruthy();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
  await page.screenshot({path:"test-results/reserva-mobile.png",fullPage:true});
});
test("El lector interpreta veinte QR distintos generados por la aplicación",async({page,request})=>{
  const seats=Array.from({length:18},(_,i)=>`H${String(i+1).padStart(2,"0")}`).concat(["I01","I02"]);
  const reserved=await request.post("/api/reservations",{headers:{Origin:origin},data:{eventId:"endgame-2026",name:"Lector de imagen QA",seats,privacyAccepted:true,requestId:crypto.randomUUID()}});expect(reserved.ok()).toBeTruthy();
  const {accessToken}=await reserved.json();const booking=await(await request.get(`/api/entries/${accessToken}`)).json();
  await page.goto("/admin/validar");await page.getByLabel("Contraseña",{exact:true}).fill(password!);await page.getByRole("button",{name:"Ingresar al equipo"}).click();await expect(page.getByRole("heading",{name:"Cada entrada cuenta."})).toBeVisible();
  for(const ticket of booking.tickets){const buffer=await QRCode.toBuffer(`CINECEFINF:${ticket.token}`,{width:320,margin:4,errorCorrectionLevel:"M"});await page.locator('input[type="file"]').setInputFiles({name:`${ticket.seat}.png`,mimeType:"image/png",buffer});await expect(page.getByRole("heading",{name:ticket.seat,exact:true})).toBeVisible();}
});
