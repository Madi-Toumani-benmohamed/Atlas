import { syntheticSession } from "./synthetic-session.mjs";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const origin=process.env.ATLAS_E2E_ORIGIN;
if(!origin||process.env.ATLAS_E2E_TEST_INSTANCE!=="true")throw Error("Dedicated synthetic test instance required");
const browser=await chromium.launch({headless:true,...(process.env.ATLAS_CHROMIUM?{executablePath:process.env.ATLAS_CHROMIUM}:{})});
try{
 const context=await browser.newContext({locale:"fr-FR"});await syntheticSession(context,origin,"catalogue-fixture");
 async function post(path,data){const r=await context.request.post(`${origin}/api/v1/${path}`,{data,headers:{Origin:origin,"Idempotency-Key":randomUUID()}});assert.equal(r.status(),201,`${path}: ${await r.text()}`);return r.json();}
 const p=await post("portfolios",{name:"Synthetic catalogue portfolio"});
 const a=await post(`portfolios/${p.id}/accounts`,{name:"Synthetic catalogue account",kind:"brokerage",currency:"EUR"});
 const held=await post("assets",{name:"Synthetic held asset",kind:"stock",symbol:"TEST",namespace:"XPAR",reference:"FR0000120271",currency:"EUR"});
 const other=await post("assets",{name:"Synthetic same symbol",kind:"stock",symbol:"TEST",namespace:"XPAR",reference:"FR0000120321",currency:"EUR"});
 const unheld=await post("assets",{name:"Synthetic unheld ETF",kind:"etf",symbol:"ETFTEST",namespace:"XPAR",reference:"IE00B4L5Y983",currency:"EUR"});
 await post("assets",{name:"Synthetic unquoted asset",kind:"crypto",symbol:"EMPTY",namespace:"synthetic",reference:"unquoted",currency:"EUR"});
 await post("operations",{kind:"deposit",account_id:a.id,amount:"10",occurred_at:"2020-01-01T00:00:00Z"});
 await post("operations",{kind:"buy",account_id:a.id,asset_id:held.id,amount:"1",price:"3",occurred_at:"2020-01-02T00:00:00Z"});
 for(const day of [4,1,7,2,6,3,5])await post("prices",{asset_id:held.id,currency:"EUR",value:String(100+day),observed_at:`2020-02-0${day}T12:00:00Z`,source:"Synthetic held quote "+"S".repeat(80)});
 await post("prices",{asset_id:other.id,currency:"EUR",value:"999",observed_at:"2020-02-08T12:00:00Z",source:"Other same symbol quote excluded"});
 await post("prices",{asset_id:unheld.id,currency:"USD",value:"0.123456789012345678",observed_at:"2020-02-08T12:00:00Z",source:"Synthetic unheld USD quote"});
 await post("prices",{currency:"USD",value:"0.5",observed_at:"2020-02-09T12:00:00Z",source:"FX observation excluded"});
 const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto(origin);await page.getByRole("button",{name:"Actifs",exact:true}).click();
 const card=name=>page.locator("li").filter({has:page.getByRole("heading",{name,exact:true})});
 const stock=card("Synthetic held asset · TEST");
 await stock.getByText("Détail des positions et résultats",{exact:true}).click();
 await stock.getByText("Quantité : ≈ 0,33333333",{exact:true}).waitFor();
 await stock.getByText("Valeurs exactes de la position",{exact:true}).click();
 await stock.getByText("1/3",{exact:true}).waitFor();
 await stock.getByText("Cours et historique de cet actif",{exact:true}).click();
 await stock.getByText("Dernier cours enregistré : 107 EUR",{exact:true}).waitFor();
 await stock.getByText("Observation d’une date antérieure à la synthèse.",{exact:true}).waitFor();
 await stock.getByText("Historique des cours enregistrés (7)",{exact:true}).click();
 const history=stock.getByRole("list",{name:"Cours enregistrés pour cet actif",exact:true});
 assert.equal(await history.getByRole("listitem").count(),5);
 await stock.getByRole("button",{name:"Afficher davantage de cours",exact:true}).click();
 assert.equal(await history.getByRole("listitem").count(),7);
 assert.ok(!(await history.innerText()).includes("Other same symbol quote excluded"));assert.ok(!(await history.innerText()).includes("FX observation excluded"));
 const etf=card("Synthetic unheld ETF · ETFTEST");
 await etf.getByText("Détail des positions et résultats",{exact:true}).click();
 await etf.getByText("Aucune position de cet actif dans cette synthèse.",{exact:true}).waitFor();
 await etf.getByText("Cours et historique de cet actif",{exact:true}).click();
 await etf.getByText("Dernier cours enregistré : 0,123456789012345678 USD",{exact:true}).waitFor();
 const empty=card("Synthetic unquoted asset · EMPTY");
 await empty.getByText("Cours et historique de cet actif",{exact:true}).click();
 await empty.getByText("Dernier cours indisponible : aucune observation enregistrée.",{exact:true}).waitFor();
 for(const theme of ["dark","light"]){
  await page.getByLabel("Thème").selectOption(theme);
  for(const width of [1440,390,320]){
   await page.setViewportSize({width,height:900});
   for(const state of [false,true]){
    for(const disclosure of await page.locator(".asset-disclosure > summary").all()){
     if(await disclosure.evaluate(el=>el.parentElement.open)!==state)await disclosure.click();
     assert.ok((await disclosure.boundingBox()).height>=44);
    }
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    const result=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"]).analyze();
    assert.deepEqual(result.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[],`${theme}/${width}/${state}`);
   }
  }
 }
 await page.getByLabel("Nom de l’actif",{exact:true}).fill("Synthetic unsaved draft");
 let failed=false;
 // Only the observation request is fault-injected; positions and metadata use the real API.
 await page.route("**/api/v1/prices",route=>{if(!failed){failed=true;return route.fulfill({status:503,contentType:"application/json",body:'{"error":"storage_unavailable"}'});}return route.continue();});
 await page.getByRole("button",{name:"Recharger les observations enregistrées",exact:true}).click();
 await page.getByRole("alert").filter({hasText:"Le service est indisponible"}).waitFor();
 assert.equal(await page.getByText("Dernier cours indisponible : aucune observation enregistrée.",{exact:true}).count(),0);
 await stock.getByText("Quantité : ≈ 0,33333333",{exact:true}).waitFor();
 assert.equal(await page.getByLabel("Nom de l’actif",{exact:true}).inputValue(),"Synthetic unsaved draft");
 await page.getByRole("button",{name:"Recharger les observations enregistrées",exact:true}).click();
 await stock.getByText("Cours et historique de cet actif",{exact:true}).click();
 await stock.getByText("Dernier cours enregistré : 107 EUR",{exact:true}).waitFor();
 assert.deepEqual(errors,[]);await context.close();
 console.log("PASS: catalogue prices for held/unheld assets, exact currencies and source dates, same-symbol/FX exclusion, progressive history, approximate position with exact fraction, isolated observation failure/retry preserving draft and 12 open/closed axe/responsive scans. Real PostgreSQL; explicit observation-failure fixture.");
}finally{await browser.close();}
