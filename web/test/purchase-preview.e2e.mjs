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
  const credentials = { email: `purchase-${randomUUID()}@example.test`, password: `Synthetic-${randomUUID()}` };
  await post("auth/register", credentials, 202);
  await post("auth/login", credentials, 200);
  const portfolio = await post("portfolios", { name: "Synthetic purchase preview" });
  const account = await post(`portfolios/${portfolio.id}/accounts`, {
    name: "Synthetic account", kind: "brokerage", currency: "EUR",
  });
  const asset = await post("assets", { name: "Synthetic preview asset", kind: "stock",
    symbol: "TEST", namespace: "XPAR", reference: "FR0000120271", currency: "EUR" });
  await post("operations", { kind: "deposit", account_id: account.id, amount: "10", occurred_at: "2020-01-01T00:00:00Z" });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(origin);
  await page.getByRole("button", { name: "Activité", exact: true }).click();
  await page.getByLabel("Type d’opération", { exact: true }).selectOption("buy");
  await page.getByLabel("Compte", { exact: true }).selectOption(account.id);
  await page.getByLabel("Actif", { exact: true }).selectOption(asset.id);
  const price = page.getByLabel("Prix unitaire dans la devise du compte", { exact: true });
  const amount = page.getByLabel("Montant total, frais inclus", { exact: true });
  const fees = page.getByLabel("Frais (facultatifs)", { exact: true });
  const preview = page.getByRole("region", { name: "Récapitulatif de l’achat", exact: true });
  await price.fill("3");
  await amount.fill("1");
  await preview.getByText("Quantité calculée : ≈ 0,33333333", { exact: true }).waitFor();
  await preview.getByText("Total débité, frais inclus : 1,00 EUR", { exact: true }).waitFor();
  await preview.getByText("Quantité exacte", { exact: true }).click();
  await preview.getByText("1/3", { exact: true }).waitFor();
  const operations = async () => {
    const response = await context.request.get(`${origin}/api/v1/operations`);
    assert.equal(response.status(), 200);
    return (await response.json()).items;
  };
  assert.equal((await operations()).length, 1, "Preview must not persist a purchase");
  await fees.fill("1");
  await preview.getByText("Le montant total doit dépasser les frais.", { exact: true }).waitFor();
  await fees.fill("0");
  await page.getByLabel("Saisir le montant total, frais inclus", { exact: true }).uncheck();
  await page.getByLabel("Quantité", { exact: true }).fill("1/3");
  await fees.fill("0.01");
  await preview.getByText("Total débité, frais inclus : 1,01 EUR", { exact: true }).waitFor();
  await page.getByLabel("Saisir le montant total, frais inclus", { exact: true }).check();
  await fees.fill("0");
  await amount.fill("20");
  await page.getByRole("button", { name: "Enregistrer l’opération", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Liquidités insuffisantes" }).waitFor();
  assert.equal(await amount.inputValue(), "20");
  assert.equal((await operations()).length, 1);
  await amount.fill("1");
  await preview.getByText("Quantité calculée : ≈ 0,33333333", { exact: true }).waitFor();
  for (const theme of ["dark", "light"]) {
    await page.getByLabel("Thème").selectOption(theme);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      assert.deepEqual(result.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })), [], `${theme}/${width}`);
    }
  }
  await page.getByRole("button", { name: "Enregistrer l’opération", exact: true }).click();
  await page.getByText("Enregistrement confirmé.", { exact: true }).waitFor();
  assert.equal((await operations()).length, 2);
  const response = await context.request.get(`${origin}/api/v1/summary`);
  assert.equal(response.status(), 200);
  const summary = await response.json();
  assert.equal(summary.positions.find(p => p.asset_id === asset.id).quantity.exact, "1/3");
  assert.equal(summary.cash.find(c => c.account_id === account.id).amount.exact, "9");
  assert.deepEqual(errors, []);
  await context.close();
  console.log("PASS: exact purchase preview and account currency, rational quantity, fees and both input modes; no write before confirmation; rejected purchase preserves draft; API result agrees with preview; 6 axe/responsive scans. Real PostgreSQL.");
} finally {
  await browser.close();
}
