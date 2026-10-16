import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (existsSync(".env.local")) {
  console.log(".env.local ya existe; se conserva.");
} else {
  writeFileSync(".env.local", `DATA_BACKEND=local\nLOCAL_ADMIN_PASSWORD=${randomBytes(12).toString("base64url")}\nSESSION_SECRET=${randomBytes(32).toString("hex")}\nRATE_LIMIT_SECRET=${randomBytes(32).toString("hex")}\n`, { flag: "wx" });
  console.log("Entorno local preparado. La clave de puerta está en LOCAL_ADMIN_PASSWORD de .env.local.");
}
