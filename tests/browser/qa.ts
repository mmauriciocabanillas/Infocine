import { randomUUID } from "node:crypto";
import { LocalStore, fingerprintFor } from "../../src/lib/local-store";
import { EVENT_ID,type ReserveInput } from "../../src/lib/domain";
function database(){
  const path=process.env.INFOCINE_E2E_DB;
  if(!path||!/^\.data\/e2e-\d+\.sqlite$/.test(path))throw new Error("Se requiere la base QA aislada.");
  return new LocalStore(path);
}
export function clearQARateLimits(){const db=database();try{db.db.exec("DELETE FROM rate_limits");}finally{db.close();}}
export function seedQABooking(name:string,seats:string[]){const db=database();try{const input:ReserveInput={eventId:EVENT_ID,name,seats,privacyAccepted:true,requestId:randomUUID()};return db.reserve(input,fingerprintFor(input));}finally{db.close();}}
