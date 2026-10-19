import { test,expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import QRCode from "qrcode";
import { clearQARateLimits,seedQABooking } from "./qa";
test.beforeEach(()=>clearQARateLimits());
const password=readFileSync(".env.local","utf8").match(/^LOCAL_ADMIN_PASSWORD=(.+)$/m)?.[1]?.trim();
const origin="http://127.0.0.1:3001";
test("Reserva, QR individual, PDF, control de puerta y cancelación",async({page,request})=>{
  const anonymous=await request.get("/api/admin/dashboard");expect(anonymous.status()).toBe(401);
  const fake=await request.post("/api/admin/ticket",{headers:{Origin:origin},data:{token:"f".repeat(64),action:"admit"}});expect(fake.status()).toBe(401);
  await page.setViewportSize({width:1280,height:980});
  await page.goto("/");await expect(page.getByRole("heading",{name:"AVENGERS ENDGAME",exact:true})).toBeVisible();
  await page.screenshot({path:"test-results/infocine-portada.png"});
  await page.screenshot({path:"test-results/inicio-desktop.png",fullPage:true});
  await page.locator("#combos").screenshot({path:"test-results/infocine-combos.png"});
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
  await page.goto("/admin");await page.getByLabel("Contraseña",{exact:true}).fill(password!);await page.getByRole("button",{name:"Ingresar al equipo"}).click();await expect(page.getByRole("heading",{name:"Reservas de la función."})).toBeVisible();
  await page.getByRole("link",{name:"Escanear QR"}).click();await page.locator('input[type="file"]').setInputFiles({name:"entrada-A01.png",mimeType:"image/png",buffer:qrBuffer});await expect(page.getByRole("heading",{name:"A01",exact:true})).toBeVisible();
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
  for(const width of [320,390,768,1280]){
    await page.setViewportSize({width,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
    expect(await page.locator("#film-title").evaluate(el=>el.scrollWidth<=el.clientWidth)).toBeTruthy();
  }
  await page.setViewportSize({width:390,height:844});
  await page.goto("/reservar/endgame-2026");await expect(page.getByRole("button",{name:/Butaca K18/})).toHaveCount(1);expect(await page.locator(".seat-scroll").evaluate(el=>el.scrollWidth>el.clientWidth)).toBeTruthy();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
  await page.screenshot({path:"test-results/reserva-mobile.png",fullPage:true});
});
test("El lector interpreta veinte QR distintos generados por la aplicación",async({page,request})=>{
  const seats=Array.from({length:18},(_,i)=>`H${String(i+1).padStart(2,"0")}`).concat(["I01","I02"]);
  const tickets=[];
  for(let index=0;index<seats.length;index+=4){
    const booking=seedQABooking(`Lector de imagen QA ${index}`,seats.slice(index,index+4));tickets.push(...booking.tickets);
  }
  await page.goto("/admin/validar");await page.getByLabel("Contraseña",{exact:true}).fill(password!);await page.getByRole("button",{name:"Ingresar al equipo"}).click();await expect(page.getByRole("heading",{name:"Control de ingreso."})).toBeVisible();
  for(const [index,ticket] of tickets.entries()){const prefix=index%2===0?"INFOCINE":"CINECEFINF";const buffer=await QRCode.toBuffer(`${prefix}:${ticket.token}`,{width:320,margin:4,errorCorrectionLevel:"M"});await page.locator('input[type="file"]').setInputFiles({name:`${ticket.seat}.png`,mimeType:"image/png",buffer});await expect(page.getByRole("heading",{name:ticket.seat,exact:true})).toBeVisible();}
});
test("Límite de cuatro, selección y borrado definitivo en todas las listas, eliminar todo y restablecer",async({page,request})=>{
  const headers={Origin:origin};
  expect((await request.delete("/api/admin/tickets",{headers,data:{action:"clear",confirmation:"ELIMINAR TODO"}})).status()).toBe(401);
  await page.goto("/reservar/endgame-2026");
  for(const seat of ["J01","J02","J03","J04","J05"])await page.getByRole("button",{name:`Butaca ${seat}, disponible`,exact:true}).click();
  await expect(page.getByRole("alert").filter({hasText:"Puedes reservar un máximo de 4 butacas."})).toBeVisible();await expect(page.locator(".selected-seats button")).toHaveCount(4);
  await page.getByLabel("Nombre completo").fill("Límite y borrado QA");await page.getByRole("checkbox").check();await page.getByRole("button",{name:"Confirmar reserva",exact:true}).click();await expect(page).toHaveURL(/\/entradas\/[a-f0-9]{64}$/);
  const access=page.url().split("/").at(-1)!;const booking=await(await request.get(`/api/entries/${access}`)).json();
  const body={eventId:"endgame-2026",name:"Límite y borrado QA",privacyAccepted:true,requestId:crypto.randomUUID()};
  expect((await request.post("/api/reservations",{headers,data:{...body,seats:["J05","J06","J07","J08","J09"]}})).status()).toBe(400);
  expect((await request.post("/api/reservations",{headers,data:{...body,seats:["J05"]}})).status()).toBe(409);
  await page.goto("/admin");await page.getByLabel("Contraseña",{exact:true}).fill(password!);await page.getByRole("button",{name:"Ingresar al equipo"}).click();await expect(page.getByRole("heading",{name:"Reservas de la función."})).toBeVisible();
  for(const [index,action] of ["admit","cancel"].entries())expect((await page.request.post("/api/admin/ticket",{headers,data:{token:booking.tickets[index].token,action}})).ok()).toBeTruthy();
  await page.reload();await page.getByLabel("Buscar por nombre o butaca").fill("Límite y borrado QA");await page.getByRole("button",{name:/^Canceladas/}).click();await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("checkbox",{name:"Seleccionar todas las entradas visibles"}).check();await page.getByRole("button",{name:"Eliminar seleccionadas"}).click();
  let dialog=page.getByRole("dialog");await expect(dialog.getByRole("button",{name:"Eliminar definitivamente"})).toBeDisabled();await dialog.getByLabel("Escribe ELIMINAR para confirmar").fill("ELIMINAR");await dialog.getByRole("button",{name:"Eliminar definitivamente"}).click();await expect(dialog).toHaveCount(0);
  await expect(page.getByText("No hay entradas con estos filtros.")).toBeVisible();expect((await(await request.get(`/api/entries/${access}`)).json()).tickets).toHaveLength(3);
  await page.getByRole("button",{name:/^Todas\d*/}).click();await page.getByRole("button",{name:"Seleccionar visibles",exact:true}).click();await page.getByRole("button",{name:"Eliminar seleccionadas"}).click();
  dialog=page.getByRole("dialog");await dialog.getByLabel("Escribe ELIMINAR para confirmar").fill("ELIMINAR");await dialog.getByRole("button",{name:"Eliminar definitivamente"}).click();await expect(dialog).toHaveCount(0);
  expect((await request.get(`/api/entries/${access}`)).status()).toBe(404);expect((await page.request.post("/api/admin/ticket",{headers,data:{token:booking.tickets[0].token,action:"verify"}})).status()).toBe(404);
  async function reserve(name:string){return seedQABooking(name,["J01","J02"]);}
  const beforeClear=await reserve("Eliminar todas QA");await page.request.patch("/api/admin/dashboard",{headers,data:{open:false}});await page.reload();await page.getByLabel("Buscar por nombre o butaca").fill("");
  await page.getByRole("button",{name:"Eliminar todas",exact:true}).click();dialog=page.getByRole("dialog");await dialog.getByLabel("Escribe ELIMINAR TODO para confirmar").fill("ELIMINAR TODO");await dialog.getByRole("button",{name:"Eliminar definitivamente"}).click();await expect(dialog).toHaveCount(0);
  expect((await request.get(`/api/entries/${beforeClear.access_token}`)).status()).toBe(404);expect((await(await request.get("/api/event")).json()).event.booking_open).toBe(false);
  await page.getByRole("button",{name:"Habilitar reservas"}).click();await expect(page.getByRole("button",{name:"Pausar reservas"})).toBeVisible();
  const beforeReset=await reserve("Restablecer QA");await page.request.post("/api/admin/ticket",{headers,data:{token:beforeReset.tickets[0].token,action:"admit"}});await page.request.patch("/api/admin/dashboard",{headers,data:{open:false}});await page.reload();
  await page.getByRole("button",{name:"Restablecer función",exact:true}).click();dialog=page.getByRole("dialog");await dialog.getByLabel("Escribe REINICIAR para confirmar").fill("REINICIAR");await dialog.getByRole("button",{name:"Restablecer función"}).click();await expect(dialog).toHaveCount(0);
  const state=await(await request.get("/api/event")).json();expect(state.occupied).toEqual([]);expect(state.event.booking_open).toBe(true);expect((await request.get(`/api/entries/${beforeReset.access_token}`)).status()).toBe(404);
  const dashboard=await(await page.request.get("/api/admin/dashboard")).json();expect(dashboard.tickets).toEqual([]);await expect(page.getByText("Aún no hay reservas. Las nuevas entradas aparecerán aquí.")).toBeVisible();
});
