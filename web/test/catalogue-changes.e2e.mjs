import { syntheticSession } from "./synthetic-session.mjs";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const origin=process.env.ATLAS_E2E_ORIGIN;
if(!origin||process.env.ATLAS_E2E_TEST_INSTANCE!=="true")throw Error("Dedicated synthetic test instance required");
const browser=await chromium.launch({headless:true,...(process.env.ATLAS_CHROMIUM?{executablePath:process.env.ATLAS_CHROMIUM}:{})});
try{
 const context=await browser.newContext({locale:"fr-FR"});await syntheticSession(context,origin,"changes-fixture");
 async function post(path,data){const r=await context.request.post(`${origin}/api/v1/${path}`,{data,headers:{Origin:origin,"Idempotency-Key":randomUUID()}});assert.equal(r.status(),201,`${path}: ${await r.text()}`);return r.json();}
 const assets=[];
 for(const [reference,name,symbol] of [["all","Synthetic all periods","TEST"],["mismatch","Synthetic currency mismatch","TEST"],["fraction","Synthetic fractional move","FRAC"],["zero","Synthetic zero move","ZERO"],["stale","Synthetic stale quote","OLD"]])
  assets.push(await post("assets",{name,symbol,kind:"crypto",namespace:"synthetic",reference,currency:"EUR"}));
 async function read(){const r=await context.request.get(`${origin}/api/v1/prices`);assert.equal(r.status(),200);assert.equal(r.headers()["cache-control"],"no-store");return r.json();}
 let result;
 for(let attempt=0;attempt<2;attempt++){
  const before=await read(),day=new Date(before.as_of);day.setUTCHours(0,0,0,0);
  const previous=new Date(day);previous.setUTCDate(previous.getUTCDate()-1);
  const week=new Date(day);week.setUTCDate(week.getUTCDate()-7);
  const y=day.getUTCFullYear(),m=day.getUTCMonth(),d=day.getUTCDate();
  const month=new Date(Date.UTC(y,m-1,Math.min(d,new Date(Date.UTC(y,m,0)).getUTCDate())));
  const year=new Date(Date.UTC(y-1,m,Math.min(d,new Date(Date.UTC(y-1,m+1,0)).getUTCDate())));
  const price=(asset,date,currency,value)=>post("prices",{asset_id:asset.id,observed_at:date.toISOString(),currency,value,source:"Synthetic period fixture"});
  for(const [date,value] of [[year,"44"],[month,"55"],[week,"88"],[previous,"100"],[day,"110"]])await price(assets[0],date,"EUR",value);
  await price(assets[1],previous,"EUR","100");await price(assets[1],day,"USD","110");
  await price(assets[2],previous,"USD","3");await price(assets[2],day,"USD","4");
  await price(assets[3],previous,"EUR","5");await price(assets[3],day,"EUR","5");
  await price(assets[4],previous,"EUR","5");
  await post("prices",{currency:"USD",value:"0.5",observed_at:day.toISOString(),source:"Synthetic FX excluded"});
  result=await read();
  if(result.as_of.slice(0,10)===day.toISOString().slice(0,10))break;
  assert.equal(attempt,0,"Server date moved repeatedly during synthetic fixture creation");
 }
 assert.ok(result.as_of.endsWith("Z"));const changes=result.asset_market_changes_percent;
 assert.deepEqual(Object.fromEntries(Object.entries(changes[assets[0].id]).map(([k,v])=>[k,v?.exact])),{day:"10",week:"25",month:"100",year:"150"});
 assert.equal(changes[assets[1].id].day,null);assert.equal(changes[assets[2].id].day.exact,"100/3");
 assert.equal(changes[assets[2].id].day.approximate,true);assert.equal(changes[assets[3].id].day.exact,"0");
 assert.ok(Object.values(changes[assets[4].id]).every(v=>v===null));assert.equal(Object.hasOwn(changes,""),false);
 const summary=await context.request.get(`${origin}/api/v1/summary`);assert.equal(summary.status(),200);assert.deepEqual((await summary.json()).positions,[]);
 const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto(origin);await page.getByRole("button",{name:"Actifs",exact:true}).click();
 const card=(name,symbol)=>page.locator("li").filter({has:page.getByRole("heading",{name:`${name} · ${symbol}`,exact:true})});
 const all=card("Synthetic all periods","TEST");await all.getByText("Cours et historique de cet actif",{exact:true}).click();
 const allChanges=all.getByRole("region",{name:"Variations du cours de cet actif",exact:true});
 for(const text of ["Un jour : 10,00 %","Une semaine : 25,00 %","Un mois : 100,00 %","Un an : 150,00 %"])await allChanges.getByText(text,{exact:true}).waitFor();
 const mismatch=card("Synthetic currency mismatch","TEST");await mismatch.getByText("Cours et historique de cet actif",{exact:true}).click();
 await mismatch.getByRole("region",{name:"Variations du cours de cet actif",exact:true}).getByText("Un jour : Non calculable",{exact:true}).waitFor();
 const fraction=card("Synthetic fractional move","FRAC");await fraction.getByText("Cours et historique de cet actif",{exact:true}).click();
 await fraction.getByText("Un jour : ≈ 33,33 %",{exact:true}).waitFor();await fraction.getByText("Variations exactes",{exact:true}).click();
 await fraction.getByText("100/3 %",{exact:true}).waitFor();
 await fraction.getByText("Variations exactes",{exact:true}).click();
 const zero=card("Synthetic zero move","ZERO");await zero.getByText("Cours et historique de cet actif",{exact:true}).click();
 await zero.getByText("Un jour : 0,00 %",{exact:true}).waitFor();
 const stale=card("Synthetic stale quote","OLD");await stale.getByText("Cours et historique de cet actif",{exact:true}).click();
 await stale.getByText("Observation d’une date antérieure à la synthèse.",{exact:true}).waitFor();
 await stale.getByText("Un jour : Non calculable",{exact:true}).waitFor();
 for(const theme of ["dark","light"]){await page.getByLabel("Thème").selectOption(theme);for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:900});
  for(const state of [false,true]){
   for(const disclosure of await page.locator(".asset-disclosure > summary").all())if(await disclosure.evaluate(el=>el.parentElement.open)!==state)await disclosure.click();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   const scan=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"]).analyze();
   assert.deepEqual(scan.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[],`${theme}/${width}/${state}`);
  }
 }}
 const stranger=await browser.newContext();assert.equal((await stranger.request.get(`${origin}/api/v1/prices`)).status(),401);
 await syntheticSession(stranger,origin,"changes-stranger");const foreign=await stranger.request.get(`${origin}/api/v1/prices`);assert.equal(foreign.status(),200);
 assert.deepEqual((await foreign.json()).asset_market_changes_percent,{});await stranger.close();
 assert.deepEqual(errors,[]);await context.close();
 console.log("PASS: market changes without holdings, exact four periods and fractional percentage, currency/date gaps unavailable, known zero distinct, FX/same-symbol exclusion, private metadata and 12 open/closed axe/responsive scans. Real PostgreSQL; synthetic observations aligned to server date.");
}finally{await browser.close();}
