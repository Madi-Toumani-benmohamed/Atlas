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
  const credentials = { email: `accounts-${randomUUID()}@example.test`, password: `Synthetic-${randomUUID()}` };
  await post("auth/register", credentials, 202);
  await post("auth/login", credentials, 200);
  const portfolio = await post("portfolios", { name: "Synthetic first portfolio" });
  const otherPortfolio = await post("portfolios", { name: "Synthetic other portfolio" });
  const account = await post(`portfolios/${portfolio.id}/accounts`, { name: "Synthetic EUR account", kind: "brokerage", currency: "EUR" });
  const unknown = await post(`portfolios/${portfolio.id}/accounts`, { name: "Synthetic USD account", kind: "brokerage", currency: "USD" });
  const empty = await post(`portfolios/${otherPortfolio.id}/accounts`, { name: "Synthetic empty account", kind: "brokerage", currency: "EUR" });
  const asset = await post("assets", { name: "Synthetic shared asset", kind: "stock", symbol: "TEST", namespace: "XPAR", reference: "FR0000120271", currency: "EUR" });
  await post("operations", { kind: "deposit", account_id: account.id, amount: "100", occurred_at: "2020-01-01T00:00:00Z" });
  await post("operations", { kind: "buy", account_id: account.id, asset_id: asset.id, quantity: "2", price: "10", fees: "1", occurred_at: "2020-01-02T00:00:00Z" });
  await post("operations", { kind: "sell", account_id: account.id, asset_id: asset.id, quantity: "1", price: "15", fees: "1", occurred_at: "2020-01-03T00:00:00Z" });
  await post("operations", { kind: "opening_cash", account_id: unknown.id, amount: "50", occurred_at: "2020-01-01T00:00:00Z" });
  await post("operations", { kind: "opening_position", account_id: unknown.id, asset_id: asset.id, quantity: "3", occurred_at: "2020-01-02T00:00:00Z" });
  await post("prices", { asset_id: asset.id, currency: "EUR", value: "12", observed_at: "2020-02-01T12:00:00Z", source: "Synthetic old quote " + "S".repeat(80) });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(origin);
  await page.getByRole("button", { name: "Portefeuilles", exact: true }).click();
  await page.getByRole("button", { name: "Synthetic first portfolio", exact: true }).click();
  const card = name => page.locator("li").filter({ has: page.getByRole("heading", { name, exact: true }) });
  const first = card("Synthetic EUR account");
  await first.getByText("Positions et résultats de ce compte", { exact: true }).click();
  const eur = first.getByRole("region", { name: "Liquidités et positions de Synthetic EUR account", exact: true });
  for (const text of ["Solde enregistré : 93,00 EUR", "Quantité : 1,00000000", "Coût restant : 10,50 EUR", "PRU économique : 10,50000000 EUR", "Résultat latent : 1,50 EUR", "Résultat réalisé : 3,50 EUR"])
    await eur.getByText(text, { exact: true }).waitFor();
  await eur.getByText("Cours d’une date antérieure à la synthèse. Cours daté, sans promesse de temps réel.", { exact: true }).waitFor();
  assert.equal(await eur.getByRole("heading", { name: "Synthetic shared asset", exact: true }).count(), 1);
  assert.ok(!(await eur.innerText()).includes("50,00 USD"));
  const second = card("Synthetic USD account");
  await second.getByText("Positions et résultats de ce compte", { exact: true }).click();
  const usd = second.getByRole("region", { name: "Liquidités et positions de Synthetic USD account", exact: true });
  for (const text of ["Solde enregistré : 50,00 USD", "Quantité : 3,00000000", "Coût restant : Non calculable", "PRU économique : Non calculable", "Résultat latent : Non calculable", "Résultat réalisé : Non calculable", "Taux de change manquant : la valeur en EUR reste indisponible."])
    await usd.getByText(text, { exact: true }).waitFor();
  for (const theme of ["dark", "light"]) {
    await page.getByLabel("Thème").selectOption(theme);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      assert.deepEqual(result.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })), [], `${theme}/${width}`);
    }
  }
  await page.getByRole("button", { name: "Synthetic other portfolio", exact: true }).click();
  const emptyCard = card("Synthetic empty account");
  await emptyCard.getByText("Positions et résultats de ce compte", { exact: true }).click();
  await emptyCard.getByText("Aucune position enregistrée dans ce compte.", { exact: true }).waitFor();
  await emptyCard.getByText("Solde enregistré : 0,00 EUR", { exact: true }).waitFor();
  assert.equal(await page.getByRole("heading", { name: "Synthetic EUR account", exact: true }).count(), 0);
  const snapshot = await context.request.get(`${origin}/api/v1/summary`);
  assert.equal(snapshot.status(), 200);
  const summary = await snapshot.json();
  assert.equal(summary.account_values_eur[account.id].exact, "105");
  assert.equal(summary.account_values_eur[unknown.id], null);
  assert.equal(summary.account_values_eur[empty.id].exact, "0");
  assert.deepEqual(errors, []);
  await context.close();
  console.log("PASS: account-scoped cash, exact costs/PRU and realized/unrealized results; shared asset remains separate across accounts; unknown cost, missing FX, dated quote and empty account; portfolio navigation and 6 axe/responsive scans. Real PostgreSQL.");
} finally {
  await browser.close();
}
