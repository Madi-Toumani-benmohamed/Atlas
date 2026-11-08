import { syntheticSession } from "./synthetic-session.mjs";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const origin = process.env.ATLAS_E2E_ORIGIN;
if (!origin || process.env.ATLAS_E2E_TEST_INSTANCE !== "true")
  throw Error("Dedicated synthetic test instance required");
const browser = await chromium.launch({ headless: true,
  ...(process.env.ATLAS_CHROMIUM ? { executablePath: process.env.ATLAS_CHROMIUM } : {}),
});
try {
  const context = await browser.newContext({ locale: "fr-FR", timezoneId: "UTC" });
  async function post(path, data, status = 201) {
    const response = await context.request.post(`${origin}/api/v1/${path}`, {
      data, headers: { Origin: origin, "Idempotency-Key": randomUUID() },
    });
    assert.equal(response.status(), status, `${path}: ${await response.text()}`);
    return response.json();
  }
  await syntheticSession(context, origin, "portfolio-fixture");
  const portfolio = await post("portfolios", { name: "Synthetic source portfolio" });
  const target = await post("portfolios", { name: "Synthetic target portfolio" });
  const partial = await post("portfolios", { name: "Synthetic partial portfolio" });
  const empty = await post("portfolios", { name: "Synthetic empty portfolio" });
  const account = await post(`portfolios/${portfolio.id}/accounts`, { name: "Synthetic source account", kind: "brokerage", currency: "EUR" });
  const other = await post(`portfolios/${target.id}/accounts`, { name: "Synthetic target account", kind: "brokerage", currency: "EUR" });
  const missing = await post(`portfolios/${partial.id}/accounts`, { name: "Synthetic partial account", kind: "brokerage", currency: "EUR" });
  const asset = await post("assets", { name: "Synthetic historical asset", kind: "stock", symbol: "TEST", namespace: "XPAR", reference: "FR0000120271", currency: "EUR" });
  await post("operations", { kind: "deposit", account_id: account.id, amount: "100", occurred_at: "2020-01-01T00:00:00Z" });
  await post("operations", { kind: "transfer", account_id: account.id, target_account_id: other.id, amount: "40", occurred_at: "2020-01-02T00:00:00Z" });
  await post("operations", { kind: "opening_position", account_id: missing.id, asset_id: asset.id, quantity: "1", occurred_at: "2020-01-01T00:00:00Z" });
  await post("prices", { asset_id: asset.id, currency: "EUR", value: "5", observed_at: "2020-01-03T00:00:00Z", source: "Synthetic dated quote" });
  const range = { from: "2020-01-01T12:00:00Z", to: "2020-01-04T12:00:00Z" };
  const path = id => `${origin}/api/v1/history?${new URLSearchParams({...range,...(id?{portfolio_id:id}:{})})}`;
  const getSeries = async id => {
    const response = await context.request.get(path(id));
    assert.equal(response.status(), 200);
    assert.equal(response.headers()["cache-control"], "no-store");
    const result = await response.json();
    assert.equal(result.metric, "valuation");
    assert.equal(result.portfolio_id, id || "");
    return result.items;
  };
  assert.deepEqual((await getSeries(portfolio.id)).map(p=>p.value_eur?.exact),["100","60","60","60"]);
  assert.ok((await getSeries(portfolio.id)).every(p=>!p.missing&&!p.uses_prior_date_observations));
  assert.deepEqual((await getSeries(target.id)).map(p=>p.value_eur?.exact),["0","40","40","40"]);
  assert.deepEqual((await getSeries(empty.id)).map(p=>p.value_eur?.exact),["0","0","0","0"]);
  const partialPoints = await getSeries(partial.id);
  assert.deepEqual(partialPoints.map(p=>p.value_eur?.exact),[undefined,undefined,"5","5"]);
  assert.ok(partialPoints[3].uses_prior_date_observations);
  assert.deepEqual((await getSeries()).map(p=>p.value_eur?.exact),[undefined,undefined,"105","105"]);
  const stranger = await browser.newContext();
  assert.equal((await stranger.request.get(path(portfolio.id))).status(),401);
  await syntheticSession(stranger,origin,"foreign-history");
  assert.equal((await stranger.request.get(path(portfolio.id))).status(),404);
  assert.equal((await stranger.request.get(path("does-not-exist"))).status(),404);
  await stranger.close();
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(origin);
  await page.getByRole("button", { name: "Portefeuilles", exact: true }).click();
  const list = () => page.getByRole("list", { name: "Valeurs historiques de ce portefeuille", exact: true });
  async function selectAndLoad(name) {
    await page.getByRole("button", { name, exact: true }).click();
    await page.getByText("Évolution de la valeur du portefeuille", { exact: true }).click();
    assert.equal(await page.getByLabel("Début de la période du portefeuille", { exact: true }).inputValue(), "");
    assert.equal(await list().count(), 0, "Old portfolio history must be cleared on navigation");
    await page.getByLabel("Début de la période du portefeuille", { exact: true }).fill("2020-01-01T12:00");
    await page.getByLabel("Fin de la période du portefeuille", { exact: true }).fill("2020-01-04T12:00");
    await page.getByRole("button", { name: "Charger la valeur historique du portefeuille", exact: true }).click();
    await list().getByRole("listitem").last().waitFor();
    assert.equal(await list().getByRole("listitem").count(), 4);
  }
  await selectAndLoad("Synthetic source portfolio");
  assert.deepEqual(await list().getByRole("listitem").locator("span").allTextContents(),["100,00 EUR","60,00 EUR","60,00 EUR","60,00 EUR"]);
  await selectAndLoad("Synthetic target portfolio");
  assert.deepEqual(await list().getByRole("listitem").locator("span").allTextContents(),["0,00 EUR","40,00 EUR","40,00 EUR","40,00 EUR"]);
  await selectAndLoad("Synthetic partial portfolio");
  assert.equal(await list().getByText("Non calculable · Données manquantes",{exact:true}).count(),2);
  await list().getByText("5,00 EUR · Observation d’une date antérieure",{exact:true}).waitFor();
  for (const theme of ["dark", "light"]) {
    await page.getByLabel("Thème").selectOption(theme);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      assert.deepEqual(result.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })), [], `${theme}/${width}`);
    }
  }
  await page.getByLabel("Fin de la période du portefeuille", { exact: true }).fill("2022-01-04T12:00");
  await page.getByRole("button", { name: "Charger la valeur historique du portefeuille", exact: true }).click();
  await page.getByRole("alert").filter({hasText:"366 jours"}).waitFor();
  assert.equal(await list().count(),0);
  assert.equal(await page.getByLabel("Fin de la période du portefeuille",{exact:true}).inputValue(),"2022-01-04T12:00");
  assert.deepEqual(errors, []);
  await context.close();
  console.log("PASS: scoped historical valuations after full transfer replay, foreign/anonymous refusal, empty portfolio, unrelated missing/stale prices excluded, partial points, scope reset, invalid range draft and 6 axe/responsive scans. Real PostgreSQL.");
} finally {
  await browser.close();
}
