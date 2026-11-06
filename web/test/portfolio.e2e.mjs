import { chromium } from "playwright";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chmod, mkdir } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
const origin = process.env.ATLAS_E2E_ORIGIN;
if (!origin || process.env.ATLAS_E2E_TEST_INSTANCE !== "true")
  throw Error("Dedicated test instance required");
const browser = await chromium.launch({
  ...(process.env.ATLAS_CHROMIUM
    ? { executablePath: process.env.ATLAS_CHROMIUM }
    : {}),
  headless: true,
});
try {
  const context = await browser.newContext({ timezoneId: "Europe/Paris" });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin);
  await page
    .getByRole("button", { name: "Créer un compte", exact: true })
    .click();
  const email = `portfolio-${randomUUID()}@example.test`,
    password = `Synthetic-${randomUUID()}`;
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Demander l’inscription" }).click();
  await page.getByRole("status").filter({ hasText: "Demande reçue" }).waitFor();
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page.getByRole("heading", { name: "Bienvenue dans Atlas" }).waitFor();
  await page
    .getByRole("button", { name: "Portefeuilles", exact: true })
    .click();
  await page
    .getByLabel("Nom du portefeuille", { exact: true })
    .fill("Portefeuille synthétique");
  await page
    .getByRole("button", { name: "Créer le portefeuille", exact: true })
    .click();
  await page
    .getByLabel("Nom du compte", { exact: true })
    .fill("Compte synthétique");
  await page
    .getByRole("button", { name: "Ajouter le compte", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Compte synthétique", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Actifs", exact: true }).click();
  await page.getByLabel("Nom de l’actif").fill("Action synthétique");
  await page.getByLabel("Symbole", { exact: true }).fill("TEST");
  await page.getByLabel("Place de cotation (MIC)").fill("XPAR");
  await page.getByLabel("ISIN", { exact: true }).fill("FR0000120271");
  await page
    .getByRole("button", { name: "Ajouter l’actif", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Action synthétique · TEST", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Activité", exact: true }).click();
  await page
    .getByRole("heading", { name: "Enregistrer une opération", exact: true })
    .waitFor();
  await page
    .getByLabel("Compte", { exact: true })
    .selectOption({ label: "Compte synthétique · EUR" });
  await page
    .getByLabel("Montant dans la devise du compte", { exact: true })
    .fill("2000");
  await page
    .getByRole("button", { name: "Enregistrer l’opération", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Dépôt · Compte synthétique", exact: true })
    .waitFor();
  await page
    .getByLabel("Type d’opération", { exact: true })
    .selectOption("buy");
  await page
    .getByLabel("Compte", { exact: true })
    .selectOption({ label: "Compte synthétique · EUR" });
  await page
    .getByLabel("Actif", { exact: true })
    .selectOption({ label: "Action synthétique · TEST" });
  await page
    .getByLabel("Prix unitaire dans la devise du compte", { exact: true })
    .fill("100");
  await page
    .getByLabel("Montant total, frais inclus", { exact: true })
    .fill("500");
  await page
    .getByRole("button", { name: "Enregistrer l’opération", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Achat · Compte synthétique", exact: true })
    .waitFor();
  await page
    .getByLabel("Actif ou taux de change", { exact: true })
    .selectOption({ label: "Action synthétique" });
  await page.getByLabel("Cours / taux positif", { exact: true }).fill("125");
  await page
    .getByLabel("Source de la valeur saisie", { exact: true })
    .fill("Fixture synthétique");
  await page
    .getByRole("button", { name: "Enregistrer le cours ou taux", exact: true })
    .click();
  await page
    .getByText("1 observation(s) conservée(s)", { exact: false })
    .waitFor();
  await page.getByRole("button", { name: "Accueil", exact: true }).click();
  await page
    .getByRole("heading", { name: "Vue d’ensemble", exact: true })
    .waitFor();
  await page
    .locator(".financial-hero")
    .getByText("2125,00 €", { exact: true })
    .waitFor();
  await page.getByText("125,00 €", { exact: true }).first().waitFor();
  // Correct the buy through the real form; original stays in audit.
  await page.getByRole("button", { name: "Activité", exact: true }).click();
  const buy = page.locator("li").filter({
    has: page.getByRole("heading", {
      name: "Achat · Compte synthétique",
      exact: true,
    }),
  });
  await buy
    .getByRole("button", { name: "Corriger ou annuler", exact: true })
    .click();
  await page.getByLabel("Motif de correction").fill("Correction de fixture");
  await page
    .getByLabel("Prix unitaire dans la devise du compte", { exact: true })
    .fill("90");
  await page
    .getByLabel("Montant total, frais inclus", { exact: true })
    .fill("450");
  await page
    .getByRole("button", { name: "Enregistrer la correction", exact: true })
    .click();
  await page
    .getByRole("heading", {
      name: "Achat · Compte synthétique · Remplacée ou annulée",
      exact: true,
    })
    .waitFor();
  await page.getByRole("button", { name: "Accueil", exact: true }).click();
  await page
    .locator(".financial-hero")
    .getByText("2175,00 €", { exact: true })
    .waitFor();
  const meta = await context.request.get(`${origin}/api/v1/portfolios`);
  assert.equal(meta.status(), 200);
  const p = (await meta.json()).items[0];
  const ac = (
    await (
      await context.request.get(`${origin}/api/v1/portfolios/${p.id}/accounts`)
    ).json()
  ).items[0];
  const csv = `external_id,kind,account_id,occurred_at,amount\nfixture-csv,deposit,${ac.id},2020-01-01T12:00:00Z,20\n`;
  await page.getByRole("button", { name: "Imports", exact: true }).click();
  await page.getByLabel("Contenu à prévisualiser", { exact: true }).fill(csv);
  await page
    .getByRole("button", { name: "Prévisualiser", exact: true })
    .click();
  await page
    .getByText("Lot cohérent, prêt à confirmer.", { exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Confirmer tout le lot", exact: true })
    .click();
  await page
    .getByText("Ce fichier est déjà confirmé.", { exact: true })
    .waitFor();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exporter mes données", exact: true })
    .click();
  const file = await download;
  assert.equal(file.suggestedFilename(), "atlas-portfolio.json");
  const stream = await file.createReadStream();
  let raw = "";
  for await (const chunk of stream) raw += chunk;
  const exported = JSON.parse(raw);
  assert.equal(exported.format, "atlas-portfolio");
  assert.equal(exported.portfolios.length, 1);
  assert.equal(exported.accounts.length, 1);
  assert.equal(exported.assets.length, 1);
  assert.equal(exported.operations.filter((o) => o.active).length, 3);
  assert.equal(exported.operations.length, 4);
  assert.ok(!raw.includes("password_hash"));
  assert.ok(!raw.includes("token_hash"));
  await page.reload();
  await page.getByRole("button", { name: "Accueil", exact: true }).click();
  await page
    .locator(".financial-hero")
    .getByText("2195,00 €", { exact: true })
    .waitFor();

  await page.getByRole("button", { name: "Activité", exact: true }).click();
  await page
    .getByLabel("Type d’opération", { exact: true })
    .selectOption("sell");
  await page
    .getByLabel("Compte", { exact: true })
    .selectOption({ label: "Compte synthétique · EUR" });
  await page
    .getByLabel("Actif", { exact: true })
    .selectOption({ label: "Action synthétique · TEST" });
  await page.getByLabel("Quantité", { exact: true }).fill("2");
  await page
    .getByLabel("Prix unitaire dans la devise du compte", { exact: true })
    .fill("130");
  await page.getByLabel("Frais (facultatifs)", { exact: true }).fill("1");
  await page
    .getByRole("button", { name: "Enregistrer l’opération", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Vente · Compte synthétique", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Accueil", exact: true }).click();
  await page
    .locator(".financial-hero")
    .getByText("2204,00 €", { exact: true })
    .waitFor();
  await page.getByText("79,00 EUR", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Activité", exact: true }).click();
  await page
    .getByLabel("Type d’opération", { exact: true })
    .selectOption("sell");
  await page
    .getByLabel("Compte", { exact: true })
    .selectOption({ label: "Compte synthétique · EUR" });
  await page
    .getByLabel("Actif", { exact: true })
    .selectOption({ label: "Action synthétique · TEST" });
  await page.getByLabel("Quantité", { exact: true }).fill("20");
  await page
    .getByLabel("Prix unitaire dans la devise du compte", { exact: true })
    .fill("130");
  await page
    .getByRole("button", { name: "Enregistrer l’opération", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Quantité insuffisante" })
    .waitFor();
  assert.equal(
    await page.getByLabel("Quantité", { exact: true }).inputValue(),
    "20",
  );
  await page.getByRole("button", { name: "Accueil", exact: true }).click();
  await page
    .locator(".financial-hero")
    .getByText("2204,00 €", { exact: true })
    .waitFor();
  for (const viewport of [
    { width: 1440, height: 960 },
    { width: 390, height: 844 },
    { width: 320, height: 740 },
  ]) {
    await page.setViewportSize(viewport);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }

  for (const theme of ["dark", "light"]) {
    await page.getByLabel("Thème").selectOption(theme);
    for (const viewport of [
      { width: 1440, height: 960 },
      { width: 320, height: 740 },
    ]) {
      await page.setViewportSize(viewport);
      for (const tab of [
        "Accueil",
        "Portefeuilles",
        "Actifs",
        "Activité",
        "Imports",
      ]) {
        await page.getByRole("button", { name: tab, exact: true }).click();
        if (tab === "Portefeuilles") {
          await page
            .getByRole("button", {
              name: "Portefeuille synthétique",
              exact: true,
            })
            .click();
        }
        if (tab === "Activité") {
          await page
            .getByLabel("Type d’opération", { exact: true })
            .selectOption("buy");
        }
        await page
          .getByRole("heading", { name: "Bienvenue dans Atlas" })
          .waitFor();
        const targetHeading = {
          Accueil: "Vue d’ensemble",
          Portefeuilles: "Mes portefeuilles",
          Actifs: "Mon référentiel d’actifs",
          Activité: "Enregistrer une opération",
          Imports: "Importer des transactions CSV",
        }[tab];
        await page
          .getByRole("heading", { name: targetHeading, exact: true })
          .waitFor();
        const result = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
          .analyze();
        assert.deepEqual(
          result.violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => n.target),
          })),
          [],
          `Accessibility: ${theme}/${viewport.width}/${tab}`,
        );
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
      }
    }
  }

  await page.getByRole("button", { name: "Accueil", exact: true }).click();
  await page
    .locator(".financial-hero")
    .getByText("2204,00 €", { exact: true })
    .waitFor();
  const range = await page.evaluate(() => {
    const format = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    const now = new Date();
    return {
      from: format(new Date(now.getTime() - 86400000)),
      to: format(now),
    };
  });
  await page.getByLabel("Début", { exact: true }).fill(range.from);
  await page.getByLabel("Fin", { exact: true }).fill(range.to);
  await page
    .getByRole("button", { name: "Charger l’historique", exact: true })
    .click();
  await page.locator(".history-chart svg").waitFor();
  for (const [theme, width, height, name] of [
    ["dark", 1440, 960, "desktop"],
    ["light", 390, 844, "mobile"],
  ]) {
    await page.setViewportSize({ width, height });
    await page.getByLabel("Thème").selectOption(theme);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    assert.deepEqual(
      result.violations.map((v) => v.id),
      [],
    );
    if (process.env.ATLAS_E2E_SCREENSHOT_DIR) {
      await mkdir(process.env.ATLAS_E2E_SCREENSHOT_DIR, { recursive: true });
      await page.screenshot({
        path: `${process.env.ATLAS_E2E_SCREENSHOT_DIR}/atlas-${name}.png`,
        fullPage: true,
      });
    }
  }
  if (process.env.ATLAS_E2E_STATE_PATH) {
    await context.storageState({ path: process.env.ATLAS_E2E_STATE_PATH });
    await chmod(process.env.ATLAS_E2E_STATE_PATH, 0o600);
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: portfolio/account/asset creation, deposit, buy-by-total, partial sale with fees and oversale rejection, quote, exact valuation, correction/audit, CSV preview/commit, complete JSON export and reload; 3 viewport widths and 22 populated accessibility scans. Real PostgreSQL.",
  );
} finally {
  await browser.close();
}
