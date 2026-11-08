import { syntheticSession } from "./synthetic-session.mjs";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const origin=process.env.ATLAS_E2E_ORIGIN;
if(!origin||process.env.ATLAS_E2E_TEST_INSTANCE!=="true")throw Error("Dedicated synthetic test instance required");
const browser=await chromium.launch({headless:true,...(process.env.ATLAS_CHROMIUM?{executablePath:process.env.ATLAS_CHROMIUM}:{})});
try{
 const context=await browser.newContext({locale:"fr-FR",timezoneId:"UTC"});await syntheticSession(context,origin,"sale-fixture");
 async function post(path,data){const r=await context.request.post(`${origin}/api/v1/${path}`,{data,headers:{Origin:origin,"Idempotency-Key":randomUUID()}});assert.equal(r.status(),201,`${path}: ${await r.text()}`);return r.json();}
 const p=await post("portfolios",{name:"Synthetic sale portfolio"});
 const a=await post(`portfolios/${p.id}/accounts`,{name:"Synthetic sale account",kind:"brokerage",currency:"EUR"});
 const held=await post("assets",{name:"Synthetic fraction",kind:"stock",symbol:"TEST",namespace:"XPAR",reference:"FR0000120271",currency:"EUR"});
 const other=await post("assets",{name:"Synthetic unheld",kind:"stock",symbol:"OTHER",namespace:"XPAR",reference:"FR0000120321",currency:"EUR"});
 await post("operations",{kind:"deposit",account_id:a.id,amount:"10",occurred_at:"2020-01-01T00:00:00Z"});
 await post("operations",{kind:"buy",account_id:a.id,asset_id:held.id,amount:"1",price:"3",occurred_at:"2020-01-02T00:00:00Z"});
 async function operations(){const r=await context.request.get(`${origin}/api/v1/operations`);assert.equal(r.status(),200);return(await r.json()).items;}
 const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto(origin);await page.getByRole("button",{name:"Activité",exact:true}).click();
 await page.getByLabel("Type d’opération",{exact:true}).selectOption("sell");
 const read=page.getByRole("button",{name:"Vérifier la quantité à cette date",exact:true});
 assert.equal(await read.isDisabled(),true);
 await page.getByLabel("Compte",{exact:true}).selectOption(a.id);
 await page.getByLabel("Actif",{exact:true}).selectOption(held.id);
 const date=page.getByLabel("Date et heure (fuseau du navigateur)",{exact:true});
 const quantity=page.getByLabel("Quantité",{exact:true});
 const region=page.getByRole("region",{name:"Disponibilité de la vente",exact:true});
 await date.fill("2020-01-01T12:00");await read.click();
 await region.getByText("Aucune position de cet actif dans ce compte à cette date.",{exact:true}).waitFor();
 await date.fill("2099-01-01T12:00");await read.click();
 await region.getByRole("alert").filter({hasText:"La date doit être valide et ne peut pas être future."}).waitFor();
 assert.equal(await date.inputValue(),"2099-01-01T12:00");assert.equal((await operations()).length,2);
 await date.fill("2020-01-03T12:00");await read.click();
 await region.getByText("Quantité détenue : ≈ 0,33333333",{exact:true}).waitFor();
 await region.getByText("Quantité détenue exacte",{exact:true}).click();await region.getByText("1/3",{exact:true}).waitFor();
 await region.getByRole("button",{name:"Utiliser la quantité exacte",exact:true}).click();
 assert.equal(await quantity.inputValue(),"1/3");assert.equal((await operations()).length,2);
 let delayNext=true,failNext=false,release,entered,heldRequest;
 const requestEntered=new Promise(resolve=>{entered=resolve;});
 // Controlled read-only delay/failure; responses otherwise come from the real private API.
 await page.route("**/api/v1/summary?at=*",async route=>{
  if(delayNext){delayNext=false;heldRequest=route.request();const response=await route.fetch();entered();await new Promise(resolve=>{release=resolve;});return route.fulfill({response});}
  if(failNext){failNext=false;return route.fulfill({status:503,contentType:"application/json",body:'{"error":"storage_unavailable"}'});}
  return route.continue();
 });
 const late=page.waitForResponse(r=>r.request()===heldRequest);
 await read.click();await requestEntered;
 await page.getByLabel("Actif",{exact:true}).selectOption(other.id);await read.click();
 await region.getByText("Aucune position de cet actif dans ce compte à cette date.",{exact:true}).waitFor();
 release();await(await late).finished();await page.evaluate(()=>new Promise(requestAnimationFrame));
 await region.getByText("Aucune position de cet actif dans ce compte à cette date.",{exact:true}).waitFor();
 assert.equal(await region.getByText("Quantité détenue :",{exact:false}).count(),0);
 await page.getByLabel("Actif",{exact:true}).selectOption(held.id);
 failNext=true;await read.click();await region.getByRole("alert").filter({hasText:"Le service est indisponible"}).waitFor();
 assert.equal(await quantity.inputValue(),"1/3");assert.equal((await operations()).length,2);
 await read.click();await region.getByText("Quantité détenue : ≈ 0,33333333",{exact:true}).waitFor();
 await page.getByLabel("Prix unitaire dans la devise du compte",{exact:true}).fill("3");
 for(const theme of ["dark","light"]){await page.getByLabel("Thème").selectOption(theme);for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const result=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"]).analyze();
  assert.deepEqual(result.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[],`${theme}/${width}`);
 }}
 await page.getByRole("button",{name:"Enregistrer l’opération",exact:true}).click();
 await page.getByText("Enregistrement confirmé.",{exact:true}).waitFor();assert.equal((await operations()).length,3);
 const response=await context.request.get(`${origin}/api/v1/summary`);assert.equal(response.status(),200);const summary=await response.json();
 assert.equal(summary.cash.find(c=>c.account_id===a.id).amount.exact,"10");
 assert.equal(summary.positions.find(p=>p.asset_id===held.id).quantity.exact,"0");
 assert.deepEqual(errors,[]);await context.close();
 console.log("PASS: dated sale availability, before/after purchase, exact 1/3 copy without persistence, stale read ignored after asset change, read failure preserves draft, full exact liquidation and 6 axe/responsive scans. Real PostgreSQL; explicit read-only delay/failure fixtures.");
}finally{await browser.close();}
