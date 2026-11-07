import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
const origin = process.env.ATLAS_E2E_ORIGIN;
if (!origin || process.env.ATLAS_E2E_TEST_INSTANCE !== "true")
  throw Error("Dedicated test instance required");
const browser = await chromium.launch({
  headless: true,
  ...(process.env.ATLAS_CHROMIUM
    ? { executablePath: process.env.ATLAS_CHROMIUM }
    : {}),
});
try {
  const context = await browser.newContext({
    timezoneId: "Europe/Paris",
    locale: "fr-FR",
  });
  const post = async (path, data, status = 201) => {
    const response = await context.request.post(`${origin}/api/v1/${path}`, {
      data,
      headers: { Origin: origin, "Idempotency-Key": randomUUID() },
    });
    assert.equal(
      response.status(),
      status,
      `${path}: ${await response.text()}`,
    );
    return response.json();
  };
  const credentials = {
    email: `reconciliation-${randomUUID()}@example.test`,
    password: `Synthetic-${randomUUID()}`,
  };
  await post("auth/register", credentials, 202);
  await post("auth/login", credentials, 200);
  const portfolio = await post("portfolios", {
    name: "Rapprochement synthétique",
  });
  const first = await post(`portfolios/${portfolio.id}/accounts`, {
    name: "Compte A synthétique",
    kind: "brokerage",
    currency: "EUR",
  });
  const second = await post(`portfolios/${portfolio.id}/accounts`, {
    name: "Compte B synthétique",
    kind: "brokerage",
    currency: "EUR",
  });
  const asset = await post("assets", {
    name: "Titre de rapprochement synthétique",
    kind: "stock",
    symbol: "TEST",
    namespace: "XPAR",
    reference: "FR0000120271",
    currency: "EUR",
  });
  await post("operations", {
    kind: "deposit",
    account_id: first.id,
    amount: "1000",
    occurred_at: "2020-01-01T12:00:00Z",
  });
  const buyEvent = {
    kind: "buy",
    account_id: first.id,
    asset_id: asset.id,
    quantity: "2",
    price: "100",
    occurred_at: "2020-01-02T12:00:00Z",
  };
  const buy = await post("operations", buyEvent);
  await post("operations", {
    kind: "transfer",
    account_id: first.id,
    target_account_id: second.id,
    asset_id: asset.id,
    quantity: "0.5",
    occurred_at: "2020-01-03T12:00:00Z",
  });
  const exported = async () =>
    (await context.request.get(`${origin}/api/v1/financial-export`)).json();
  const before = await exported();
  assert.equal(before.operations.length, 3);
  assert.equal(before.imports.length, 0);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin);
  await page.getByRole("button", { name: "Imports", exact: true }).click();
  await page
    .getByLabel("Compte du relevé", { exact: true })
    .selectOption(first.id);
  await page
    .getByLabel("Date et heure du relevé", { exact: true })
    .fill("2020-01-02T14:00");
  const input = page.getByLabel("Soldes et positions du relevé", {
    exact: true,
  });
  await input.fill(`kind,asset_id,value\ncash,,800\nposition,${asset.id},2\n`);
  await page
    .getByRole("button", { name: "Comparer au journal", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Aucun écart sur les éléments contrôlés." })
    .waitFor();
  await page.getByText(/2020-01-02T13:00:00Z/).waitFor();

  await input.fill("kind,asset_id,value\ncash,,800\n");
  assert.equal(
    await page
      .getByRole("heading", { name: "Résultat du rapprochement", exact: true })
      .count(),
    0,
  );
  await page
    .getByLabel("Le relevé contient toutes les positions de ce compte", {
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "Comparer au journal", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "1 écart(s) détecté(s)." })
    .waitFor();
  await page
    .getByText("Absent du relevé déclaré complet : référence nulle.", {
      exact: true,
    })
    .waitFor();
  await page
    .getByLabel("Le relevé contient toutes les positions de ce compte", {
      exact: true,
    })
    .uncheck();
  await page
    .getByRole("button", { name: "Comparer au journal", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Aucun écart sur les éléments contrôlés." })
    .waitFor();
  await page
    .getByText(/Contrôle partiel : positions omises non contrôlées/)
    .waitFor();

  await page
    .getByLabel("Date et heure du relevé", { exact: true })
    .fill("2020-01-03T14:00");
  await input.fill(
    `kind,asset_id,value\ncash,,800\nposition,${asset.id},1.499999999\n`,
  );
  await page
    .getByRole("button", { name: "Comparer au journal", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "1 écart(s) détecté(s)." })
    .waitFor();
  await page.getByText(/Écart exact : 1\/1000000000/).waitFor();
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", {
      name: "Exporter le rapport de rapprochement",
      exact: true,
    })
    .click();
  const file = await downloaded;
  assert.equal(
    file.suggestedFilename(),
    "atlas-reconciliation-2020-01-03.json",
  );
  let raw = "";
  for await (const chunk of await file.createReadStream()) raw += chunk;
  const report = JSON.parse(raw);
  assert.equal(
    report.rows.find((row) => row.asset_id === asset.id).delta.exact,
    "1/1000000000",
  );
  assert.equal(report.as_of, "2020-01-03T13:00:00Z");
  assert.equal(report.complete_positions, false);
  const after = await exported();
  assert.deepEqual(after.operations, before.operations);
  assert.deepEqual(after.imports, before.imports);

  await page
    .getByText("Identifiants de mes actifs pour le relevé", { exact: true })
    .click();
  for (const theme of ["dark", "light"]) {
    await page.getByLabel("Thème").selectOption(theme);
    for (const width of [1440, 320]) {
      await page.setViewportSize({ width, height: 900 });
      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      assert.deepEqual(
        axe.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
        [],
        `${theme}/${width}`,
      );
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
    }
  }
  await page
    .getByLabel("Compte du relevé", { exact: true })
    .selectOption(second.id);
  await input.fill(`kind,asset_id,value\nposition,${asset.id},0.5\n`);
  await page
    .getByRole("button", { name: "Comparer au journal", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Aucun écart sur les éléments contrôlés." })
    .waitFor();
  await page.getByText(/Liquidités non contrôlées/).waitFor();

  await post(`operations/${buy.id}/corrections`, {
    replacement: { ...buyEvent, price: "90" },
    reason: "Correction synthétique pour rapprochement historique",
  });
  const corrected = await exported();
  await page
    .getByLabel("Compte du relevé", { exact: true })
    .selectOption(first.id);
  await page
    .getByLabel("Date et heure du relevé", { exact: true })
    .fill("2020-01-02T14:00");
  await input.fill(`kind,asset_id,value\ncash,,800\nposition,${asset.id},2\n`);
  await page
    .getByRole("button", { name: "Comparer au journal", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "1 écart(s) détecté(s)." })
    .waitFor();
  await page.getByText(/Écart exact : 20\./).waitFor();
  if (process.env.ATLAS_E2E_SCREENSHOT_DIR) {
    await mkdir(process.env.ATLAS_E2E_SCREENSHOT_DIR, { recursive: true });
    await page
      .getByRole("heading", { name: "Résultat du rapprochement", exact: true })
      .evaluate(element => element.scrollIntoView({block: "start"}));
    await page.screenshot({
      path: `${process.env.ATLAS_E2E_SCREENSHOT_DIR}/reconciliation-report.png`,
    });
  }
  await input.fill("kind,asset_id,value\ncash,,800\ncash,,800\n");
  await page
    .getByRole("button", { name: "Comparer au journal", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "plusieurs soldes" })
    .waitFor();
  assert.equal(
    await input.inputValue(),
    "kind,asset_id,value\ncash,,800\ncash,,800\n",
  );
  const end = await exported();
  assert.deepEqual(end.operations, corrected.operations);
  assert.deepEqual(errors, []);
  if (process.env.ATLAS_E2E_SCREENSHOT_DIR) {
    await mkdir(process.env.ATLAS_E2E_SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({
      path: `${process.env.ATLAS_E2E_SCREENSHOT_DIR}/reconciliation-mobile.png`,
      fullPage: true,
    });
  }
  await context.close();
  console.log(
    "PASS: read-only reconciliation, historical dates/timezone, partial/complete statements, exact tiny delta, transfers, corrected history, JSON report, duplicate rejection/input preservation; 4 populated accessibility scans.",
  );
} finally {
  await browser.close();
}
