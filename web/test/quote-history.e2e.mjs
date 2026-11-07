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
  const credentials = { email: `quotes-${randomUUID()}@example.test`, password: `Synthetic-${randomUUID()}` };
  await post("auth/register", credentials, 202);
  await post("auth/login", credentials, 200);
  const portfolio = await post("portfolios", { name: "Synthetic quote history" });
  const account = await post(`portfolios/${portfolio.id}/accounts`, {
    name: "Synthetic account", kind: "brokerage", currency: "EUR",
  });
  const asset = await post("assets", { name: "Synthetic history asset", kind: "stock",
    symbol: "TEST", namespace: "XPAR", reference: "FR0000120271", currency: "EUR" });
  const other = await post("assets", { name: "Synthetic other asset", kind: "stock",
    symbol: "OTHER", namespace: "XPAR", reference: "FR0000120321", currency: "EUR" });
  const noQuotes = await post("assets", { name: "Synthetic unquoted asset", kind: "stock",
    symbol: "EMPTY", namespace: "XPAR", reference: "FR0000121014", currency: "EUR" });
  await post("operations", { kind: "deposit", account_id: account.id, amount: "1000", occurred_at: "2020-01-01T00:00:00Z" });
  for (const id of [asset.id, noQuotes.id])
    await post("operations", { kind: "buy", account_id: account.id, asset_id: id,
      quantity: "1", price: "10", occurred_at: "2020-01-02T00:00:00Z" });
  // Insert out of order; only the API's chronological order should determine display.
  for (const day of [4, 1, 7, 2, 6, 3, 5])
    await post("prices", { asset_id: asset.id, currency: day === 2 ? "USD" : "EUR",
      value: `10${day}.123456789012345678`, observed_at: `2020-02-0${day}T12:00:00Z`,
      source: `Synthetic quote ${day} ` + "S".repeat(80) });
  await post("prices", { asset_id: other.id, currency: "EUR", value: "999", observed_at: "2020-02-08T12:00:00Z", source: "Other asset quote excluded" });
  await post("prices", { currency: "USD", value: "1.1", observed_at: "2020-02-09T12:00:00Z", source: "FX observation excluded" });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(origin);
  await page.getByRole("heading", { name: "Vue d’ensemble", exact: true }).waitFor();
  const position = page.locator("li").filter({ has: page.getByRole("heading", { name: "Synthetic history asset", exact: true }) });
  await position.getByText("Historique des cours enregistrés (7)", { exact: true }).click();
  const list = position.getByRole("list", { name: "Cours enregistrés pour cet actif" });
  assert.equal(await list.getByRole("listitem").count(), 5);
  assert.deepEqual(await list.locator("time").evaluateAll(nodes => nodes.map(n => n.dateTime)),
    [7, 6, 5, 4, 3].map(day => `2020-02-0${day}T12:00:00Z`));
  await position.getByRole("button", { name: "Afficher davantage de cours", exact: true }).click();
  assert.equal(await list.getByRole("listitem").count(), 7);
  await list.getByText("Cours : 102.123456789012345678 USD", { exact: true }).waitFor();
  assert.equal(await position.getByRole("button", { name: "Afficher davantage de cours", exact: true }).count(), 0);
  assert.ok(!(await position.innerText()).includes("Other asset quote excluded"));
  assert.ok(!(await position.innerText()).includes("FX observation excluded"));
  const empty = page.locator("li").filter({ has: page.getByRole("heading", { name: "Synthetic unquoted asset", exact: true }) });
  await empty.getByText("Historique des cours enregistrés (0)", { exact: true }).click();
  await empty.getByText("Aucun cours enregistré pour cet actif.", { exact: true }).waitFor();
  for (const theme of ["dark", "light"]) {
    await page.getByLabel("Thème").selectOption(theme);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      assert.deepEqual(result.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })), [], `${theme}/${width}`);
    }
  }
  assert.deepEqual(errors, []);
  await context.close();
  console.log("PASS: persisted asset quote history, exact values and currencies, newest-first order, progressive disclosure, empty state, FX/other-asset exclusion and 6 accessibility scans.");
} finally {
  await browser.close();
}
