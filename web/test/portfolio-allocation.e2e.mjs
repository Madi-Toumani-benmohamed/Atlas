import { syntheticSession } from "./synthetic-session.mjs";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const origin = process.env.ATLAS_E2E_ORIGIN;
if (!origin || process.env.ATLAS_E2E_TEST_INSTANCE !== "true") throw Error("Dedicated synthetic test instance required");
const browser = await chromium.launch({headless:true,...(process.env.ATLAS_CHROMIUM?{executablePath:process.env.ATLAS_CHROMIUM}:{})});
try {
 const context = await browser.newContext({locale:"fr-FR"});
 await syntheticSession(context,origin,"allocation-fixture");
 async function post(path,data){const r=await context.request.post(`${origin}/api/v1/${path}`,{data,headers:{Origin:origin,"Idempotency-Key":randomUUID()}});assert.equal(r.status(),201,`${path}: ${await r.text()}`);return r.json();}
 const first=await post("portfolios",{name:"Synthetic allocation first"});
 const second=await post("portfolios",{name:"Synthetic allocation other"});
 const empty=await post("portfolios",{name:"Synthetic allocation empty"});
 const a=await post(`portfolios/${first.id}/accounts`,{name:"Synthetic EUR brokerage",kind:"brokerage",currency:"EUR"});
 const savings=await post(`portfolios/${first.id}/accounts`,{name:"Synthetic savings",kind:"savings",currency:"EUR",savings_product:"livret_a"});
 const b=await post(`portfolios/${second.id}/accounts`,{name:"Synthetic USD brokerage",kind:"brokerage",currency:"USD"});
 const stock=await post("assets",{name:"Synthetic stock",kind:"stock",symbol:"TEST",namespace:"XPAR",reference:"FR0000120271",currency:"EUR"});
 const unknown=await post("assets",{name:"Synthetic unpriced stock",kind:"stock",symbol:"MISSING",namespace:"XPAR",reference:"FR0000120321",currency:"EUR"});
 const etf=await post("assets",{name:"Synthetic ETF",kind:"etf",symbol:"TESTETF",namespace:"XPAR",reference:"IE00B4L5Y983",currency:"EUR"});
 await post("operations",{kind:"deposit",account_id:a.id,amount:"100",occurred_at:"2020-01-01T00:00:00Z"});
 await post("operations",{kind:"buy",account_id:a.id,asset_id:stock.id,quantity:"2",price:"10",fees:"1",occurred_at:"2020-01-01T01:00:00Z"});
 await post("operations",{kind:"deposit",account_id:savings.id,amount:"50",occurred_at:"2020-01-01T00:00:00Z"});
 await post("operations",{kind:"interest",account_id:savings.id,amount:"2",occurred_at:"2020-01-01T01:00:00Z"});
 await post("operations",{kind:"opening_cash",account_id:b.id,amount:"10",occurred_at:"2020-01-01T00:00:00Z"});
 await post("operations",{kind:"opening_position",account_id:b.id,asset_id:etf.id,quantity:"1",occurred_at:"2020-01-01T01:00:00Z"});
 const price=(asset_id,currency,value)=>post("prices",{asset_id,currency,value,observed_at:"2020-01-02T12:00:00Z",source:"Synthetic allocation quote"});
 await price(stock.id,"EUR","12");
 async function summary(){const r=await context.request.get(`${origin}/api/v1/summary`);assert.equal(r.status(),200);assert.equal(r.headers()["cache-control"],"no-store");return r.json();}
 let state=await summary();
 assert.equal(state.total_value_eur,null);
 assert.equal(state.portfolio_allocations_eur[first.id].total_value_eur.exact,"155");
 assert.equal(state.portfolio_allocations_eur[second.id].missing_valuation,true);
 assert.deepEqual(state.portfolio_allocations_eur[second.id].by_kind_eur,{});
 assert.equal(state.portfolio_values_eur[empty.id].exact,"0");
 assert.equal(state.portfolio_allocations_eur[empty.id].total_value_eur.exact,"0");
 const page=await context.newPage();page.setDefaultTimeout(15000);
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto(origin);
 const region=()=>page.getByRole("region",{name:"Répartition du portefeuille sélectionné",exact:true});
 async function select(name){
  await page.getByRole("button",{name:"Portefeuilles",exact:true}).click();
  await page.getByRole("button",{name,exact:true}).click();
  await page.getByText("Répartition de ce portefeuille",{exact:true}).click();
  await region().waitFor();
 }
 await select("Synthetic allocation first");
 for(const text of ["Valeur connue : 155,00 EUR","Actions : 24,00 EUR","Liquidités : 79,00 EUR","Épargne : 52,00 EUR"])
  await region().getByText(text,{exact:true}).waitFor();
 assert.equal(await region().getByRole("listitem").count(),3);
 await region().getByText("Cette répartition utilise des cours ou taux d’une date antérieure à la synthèse.",{exact:false}).waitFor();
 await post("operations",{kind:"opening_position",account_id:a.id,asset_id:unknown.id,quantity:"1",occurred_at:"2020-01-01T02:00:00Z"});
 await page.getByRole("button",{name:"Accueil",exact:true}).click();
 await select("Synthetic allocation first");
 await region().getByText("Répartition partielle : seules les valeurs connues sont incluses.",{exact:false}).waitFor();
 await region().getByText("Valeur connue : 155,00 EUR",{exact:true}).waitFor();
 await region().getByText("Actions : 24,00 EUR",{exact:true}).waitFor();
 assert.equal(await region().getByRole("listitem").count(),3);
 for(const theme of ["dark","light"]){
  await page.getByLabel("Thème").selectOption(theme);
  for(const width of [1440,390,320]){
   await page.setViewportSize({width,height:900});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   const result=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"]).analyze();
   assert.deepEqual(result.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[],`${theme}/${width}`);
  }
 }
 await price(unknown.id,"EUR","7");await price(etf.id,"EUR","8");await price("","USD","0.5");
 await page.getByRole("button",{name:"Accueil",exact:true}).click();
 await select("Synthetic allocation other");
 for(const text of ["Valeur connue : 13,00 EUR","ETF : 8,00 EUR","Liquidités : 5,00 EUR"])
  await region().getByText(text,{exact:true}).waitFor();
 assert.equal(await region().getByText("Épargne :",{exact:false}).count(),0);
 await page.getByRole("button",{name:"Accueil",exact:true}).click();
 await select("Synthetic allocation empty");
 await region().getByText("Valeur connue : 0,00 EUR",{exact:true}).waitFor();
 await region().getByText("Aucune valeur à répartir dans ce portefeuille.",{exact:true}).waitFor();
 state=await summary();assert.equal(state.total_value_eur.exact,"175");
 assert.equal(state.portfolio_allocations_eur[first.id].known_value_eur.exact,"162");
 const stranger=await browser.newContext();await syntheticSession(stranger,origin,"allocation-stranger");
 const foreign=await stranger.request.get(`${origin}/api/v1/summary`);assert.equal(foreign.status(),200);
 assert.deepEqual((await foreign.json()).portfolio_allocations_eur,{});await stranger.close();
 assert.deepEqual(errors,[]);await context.close();
 console.log("PASS: exact portfolio allocation, brokerage/savings separation, missing quote and FX stay partial, scoped categories, known/empty zero, cross-user isolation and 6 axe/responsive scans. Real PostgreSQL.");
} finally {await browser.close();}
