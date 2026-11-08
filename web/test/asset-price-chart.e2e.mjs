import { syntheticSession } from "./synthetic-session.mjs";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const origin=process.env.ATLAS_E2E_ORIGIN;
if(!origin||process.env.ATLAS_E2E_TEST_INSTANCE!=="true")throw Error("Dedicated synthetic test instance required");
const browser=await chromium.launch({headless:true,...(process.env.ATLAS_CHROMIUM?{executablePath:process.env.ATLAS_CHROMIUM}:{})});
try{
 const context=await browser.newContext({locale:"fr-FR",timezoneId:"UTC"});await syntheticSession(context,origin,"chart-fixture");
 async function post(path,data){const r=await context.request.post(`${origin}/api/v1/${path}`,{data,headers:{Origin:origin,"Idempotency-Key":randomUUID()}});assert.equal(r.status(),201,`${path}: ${await r.text()}`);return r.json();}
 const asset=await post("assets",{name:"Synthetic chart asset",symbol:"TEST",kind:"crypto",namespace:"synthetic",reference:"chart",currency:"EUR"});
 const other=await post("assets",{name:"Synthetic same symbol chart",symbol:"TEST",kind:"crypto",namespace:"synthetic",reference:"other",currency:"EUR"});
 for(const [date,value,currency,id] of [
  ["2020-01-01T12:00:00Z","0.000000000000000001","EUR",asset.id],
  ["2020-01-02T12:00:00Z","0.123456789012345678","EUR",asset.id],
  ["2020-01-03T11:59:59.999999Z","100","EUR",asset.id],
  ["2020-01-03T12:00:00Z","0.5","EUR",asset.id],
  ["2020-01-03T12:00:00.000001Z","999","EUR",asset.id],
  ["2020-01-02T12:00:00Z","777","USD",asset.id],
  ["2020-01-02T12:00:00Z","888","EUR",other.id],
  ["2020-01-02T12:00:00Z","0.5","USD",""],
 ])await post("prices",{asset_id:id,observed_at:date,value,currency,source:"Synthetic historical observation"});
 const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto(origin);await page.getByRole("button",{name:"Actifs",exact:true}).click();
 const card=page.locator("li").filter({has:page.getByRole("heading",{name:"Synthetic chart asset · TEST",exact:true})});
 await card.getByText("Cours et historique de cet actif",{exact:true}).click();
 await card.getByText("Graphique des observations de cours",{exact:true}).click();
 const chart=card.locator(".asset-chart");
 const currency=chart.getByLabel("Devise du graphique",{exact:true});
 const from=chart.getByLabel("Début du graphique (fuseau du navigateur)",{exact:true});
 const to=chart.getByLabel("Fin du graphique (fuseau du navigateur)",{exact:true});
 assert.equal(await currency.inputValue(),"");assert.equal(await from.inputValue(),"");assert.equal(await to.inputValue(),"");
 await currency.selectOption("EUR");await from.fill("2020-01-01T12:00");await to.fill("2020-01-03T12:00");
 const draw=chart.getByRole("button",{name:"Tracer les observations",exact:true});await draw.click();
 const series=()=>chart.getByRole("list",{name:"Observations exactes du graphique",exact:true});
 const image=()=>chart.getByRole("img");
 await series().getByRole("listitem").last().waitFor();assert.equal(await series().getByRole("listitem").count(),4);
 assert.equal(await image().locator("circle").count(),4);assert.equal(await image().locator("polyline").count(),0);
 await series().getByText("0,000000000000000001 EUR · Synthetic historical observation",{exact:true}).waitFor();
 await series().getByText("0,123456789012345678 EUR · Synthetic historical observation",{exact:true}).waitFor();
 assert.ok(!(await series().innerText()).includes("999 EUR"));assert.ok(!(await series().innerText()).includes("888 EUR"));assert.ok(!(await series().innerText()).includes("USD"));
 const timestamps=await series().locator("time").evaluateAll(nodes=>nodes.map(n=>n.dateTime));
 assert.ok(timestamps.includes("2020-01-03T11:59:59.999999Z"));assert.ok(!timestamps.includes("2020-01-03T12:00:00.000001Z"));
 for(const theme of ["dark","light"]){await page.getByLabel("Thème").selectOption(theme);for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:900});
  for(const state of [false,true]){
   if(await chart.evaluate(el=>el.open)!==state)await card.getByText("Graphique des observations de cours",{exact:true}).click();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   const scan=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"]).analyze();
   assert.deepEqual(scan.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[],`${theme}/${width}/${state}`);
  }
 }}
 await to.fill("2022-01-03T12:00");await draw.click();await chart.getByRole("alert").filter({hasText:"366 jours"}).waitFor();assert.equal(await image().count(),0);assert.equal(await to.inputValue(),"2022-01-03T12:00");
 await from.fill("2019-01-01T12:00");await to.fill("2019-01-03T12:00");await draw.click();await chart.getByText("Aucune observation dans cette devise et cette période.",{exact:true}).waitFor();assert.equal(await image().count(),0);
 await currency.selectOption("USD");assert.equal(await series().count(),0);
 await from.fill("2020-01-01T12:00");await to.fill("2020-01-03T12:00");await draw.click();await series().getByRole("listitem").last().waitFor();assert.equal(await series().getByRole("listitem").count(),1);await series().getByText("777 USD · Synthetic historical observation",{exact:true}).waitFor();
 const quotes=await context.request.get(`${origin}/api/v1/prices`);assert.equal(quotes.status(),200);assert.equal((await quotes.json()).items.length,8);
 assert.deepEqual(errors,[]);await context.close();
 console.log("PASS: historical price scatter with explicit currency/range, exact tiny/18-decimal values, microsecond cutoff, no FX/same-symbol mixing or interpolation, invalid/empty periods, source unchanged and 12 open/closed axe/responsive scans. Real PostgreSQL.");
}finally{await browser.close();}
