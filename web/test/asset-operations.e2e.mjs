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
  const context = await browser.newContext({ locale: "fr-FR" });
  async function post(path, data, status = 201) {
    const response = await context.request.post(`${origin}/api/v1/${path}`, {
      data, headers: { Origin: origin, "Idempotency-Key": randomUUID() },
    });
    assert.equal(response.status(), status, `${path}: ${await response.text()}`);
    return response.json();
  }
  await syntheticSession(context, origin, "portfolio-fixture");
  const portfolio = await post("portfolios", { name: "Synthetic asset history" });
  const account = await post(`portfolios/${portfolio.id}/accounts`, { name: "Synthetic first account", kind: "brokerage", currency: "EUR" });
  const second = await post(`portfolios/${portfolio.id}/accounts`, { name: "Synthetic second account", kind: "brokerage", currency: "EUR" });
  const asset = await post("assets", { name: "Synthetic audit asset", kind: "stock", symbol: "TEST", namespace: "XPAR", reference: "FR0000120271", currency: "EUR" });
  const other = await post("assets", { name: "Synthetic unrelated asset", kind: "stock", symbol: "OTHER", namespace: "XPAR", reference: "FR0000120321", currency: "EUR" });
  await post("operations", { kind: "deposit", account_id: account.id, amount: "100", occurred_at: "2020-01-01T00:00:00Z", note: "Deposit without asset excluded" });
  const original = await post("operations", { kind: "buy", account_id: account.id, asset_id: asset.id, amount: "10", price: "2", occurred_at: "2020-01-02T00:00:00Z", note: "Synthetic original total" });
  for (let day = 3; day <= 7; day++)
    await post("operations", { kind: "buy", account_id: account.id, asset_id: asset.id, quantity: "1", price: "2", occurred_at: `2020-01-0${day}T00:00:00Z` });
  await post(`operations/${original.id}/corrections`, { reason: "Synthetic audited correction", replacement: { kind: "buy", account_id: account.id, asset_id: asset.id, amount: "8", price: "2", occurred_at: "2020-01-02T00:00:00Z", note: "Synthetic corrected total" } });
  await post("operations", { kind: "deposit", account_id: second.id, amount: "50", occurred_at: "2020-01-01T00:00:00Z" });
  const latest = await post("operations", { kind: "buy", account_id: second.id, asset_id: asset.id, quantity: "2", price: "2", occurred_at: "2020-01-02T00:00:00Z", note: "Synthetic second account trade" });
  await post("operations", { kind: "buy", account_id: account.id, asset_id: other.id, quantity: "1", price: "1", occurred_at: "2020-01-02T00:00:00Z", note: "Unrelated asset excluded" });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(origin);
  await page.getByRole("heading", { name: "Vue d’ensemble", exact: true }).waitFor();
  const position = page.locator("li").filter({ has: page.getByRole("heading", { name: "Synthetic audit asset", exact: true }) });
  await position.getByText("Opérations enregistrées pour cet actif (8)", { exact: true }).click();
  const list = position.getByRole("list", { name: "Historique des opérations de cet actif", exact: true });
  assert.equal(await list.getByRole("listitem").count(), 5);
  await list.getByRole("listitem").first().getByText("Note : Synthetic second account trade", { exact: true }).waitFor();
  await position.getByRole("button", { name: "Afficher davantage d’opérations", exact: true }).click();
  assert.equal(await list.getByRole("listitem").count(), 8);
  const replaced = list.getByRole("listitem").filter({ hasText: "Note : Synthetic original total" });
  await replaced.getByText("Statut : Remplacée ou annulée", { exact: true }).waitFor();
  await replaced.getByText("Montant saisi : 10 EUR", { exact: true }).waitFor();
  const corrected = list.getByRole("listitem").filter({ hasText: "Note : Synthetic corrected total" });
  await corrected.getByText("Statut : Active", { exact: true }).waitFor();
  await corrected.getByText("Montant saisi : 8 EUR", { exact: true }).waitFor();
  await corrected.getByText("Motif : Synthetic audited correction", { exact: true }).waitFor();
  assert.equal(await list.getByText("Statut : Active", { exact: true }).count(), 7);
  assert.ok(!(await list.innerText()).includes("Unrelated asset excluded"));
  assert.ok(!(await list.innerText()).includes("Deposit without asset excluded"));
  assert.equal(await position.getByRole("button", { name: "Afficher davantage d’opérations", exact: true }).count(), 0);
  for (const theme of ["dark", "light"]) {
    await page.getByLabel("Thème").selectOption(theme);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      assert.deepEqual(result.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })), [], `${theme}/${width}`);
    }
  }
  const response = await context.request.get(`${origin}/api/v1/operations`);
  assert.equal(response.status(), 200);
  const operations = (await response.json()).items;
  assert.equal(operations.filter(e => e.asset_id === asset.id).length, 8);
  assert.equal(operations.find(e => e.id === original.id).active, false);
  assert.equal(operations.find(e => e.id === latest.id).active, true);
  assert.deepEqual(errors, []);
  await context.close();
  console.log("PASS: asset-scoped source operations, both accounts, registration order, preserved original and audited correction, progressive disclosure, unrelated asset/cash exclusion and 6 axe/responsive scans. Real PostgreSQL.");
} finally {
  await browser.close();
}
