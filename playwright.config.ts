import { defineConfig,devices } from "@playwright/test";
const database=process.env.INFOCINE_E2E_DB??`.data/e2e-${Date.now()}.sqlite`;
process.env.INFOCINE_E2E_DB=database;
export default defineConfig({
  testDir:"./tests/browser",fullyParallel:false,workers:1,timeout:60000,
  use:{baseURL:"http://127.0.0.1:3001",trace:"retain-on-failure"},
  projects:[{name:"chromium",use:{...devices["Desktop Chrome"],channel:"msedge"}}],
  webServer:{command:"npm run start -- --port 3001",url:"http://127.0.0.1:3001/api/event",timeout:60000,reuseExistingServer:false,env:{DATA_BACKEND:"local",LOCAL_DB_PATH:database}}
});
