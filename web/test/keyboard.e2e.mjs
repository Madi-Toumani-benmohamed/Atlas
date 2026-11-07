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
  const context = await browser.newContext({ locale: "fr-FR", reducedMotion: "reduce",
    viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  async function tabTo(target) {
    await target.waitFor({ state: "visible" });
    for (let i = 0; i < 160; i++) {
      if (await target.evaluate(el => el === document.activeElement)) {
        const outline = await target.evaluate(el => {
          const style = getComputedStyle(el);
          return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
        });
        assert.notEqual(outline.style, "none", "Keyboard focus must be visible");
        assert.ok(outline.width >= 2, "Keyboard focus needs a visible outline");
        return;
      }
      await page.keyboard.press("Tab");
    }
    throw Error("Target unreachable by keyboard Tab");
  }
  async function activate(target) { await tabTo(target); await page.keyboard.press("Enter"); }
  async function type(target, value) {
    await tabTo(target); await page.keyboard.press("ControlOrMeta+A"); await page.keyboard.type(value);
  }
  const button = name => page.getByRole("button", { name, exact: true });
  const email = `keyboard-${randomUUID()}@example.test`, password = `Synthetic-${randomUUID()}`;
  await page.goto(origin);
  await activate(button("Créer un compte"));
  await type(page.getByLabel("Adresse e-mail"), email);
  await type(page.getByLabel("Mot de passe", { exact: true }), password);
  await activate(button("Demander l’inscription"));
  await page.getByRole("status").filter({ hasText: "Demande reçue" }).waitFor();
  await type(page.getByLabel("Mot de passe", { exact: true }), password);
  await activate(button("Se connecter"));
  await page.getByRole("heading", { name: "Bienvenue dans Atlas" }).waitFor();
  await activate(button("Portefeuilles"));
  const portfolioName = "Portefeuille_synthetique_" + "P".repeat(80);
  const accountName = "Compte_synthetique_" + "C".repeat(90);
  await type(page.getByLabel("Nom du portefeuille", { exact: true }), portfolioName);
  await activate(button("Créer le portefeuille"));
  await type(page.getByLabel("Nom du compte", { exact: true }), accountName);
  await activate(button("Ajouter le compte"));
  await page.getByRole("heading", { name: accountName, exact: true }).waitFor();
  await activate(button("Activité"));
  const accountSelect = page.getByLabel("Compte", { exact: true });
  await tabTo(accountSelect);
  await page.keyboard.press("End");
  await page.keyboard.press("Tab");
  const amount = page.getByLabel("Montant dans la devise du compte", { exact: true });
  await type(amount, "100");
  await activate(button("Enregistrer l’opération"));
  await page.getByText("Enregistrement confirmé.", { exact: true }).waitFor();
  const operations = async () => {
    const result = await context.request.get(`${origin}/api/v1/operations`);
    assert.equal(result.status(), 200);
    return (await result.json()).items;
  };
  assert.equal((await operations()).length, 1);
  await activate(button("Dupliquer"));
  await page.getByText("Copie préparée. Vérifiez-la avant de l’enregistrer.", { exact: true }).waitFor();
  assert.equal((await operations()).length, 1, "Preparing a duplicate must not persist it");
  assert.equal(await amount.inputValue(), "100");
  await activate(button("Enregistrer l’opération"));
  await page.getByText("Enregistrement confirmé.", { exact: true }).waitFor();
  const duplicated = await operations();
  assert.equal(duplicated.length, 2);
  assert.notEqual(duplicated[0].id, duplicated[1].id);
  const kind = page.getByLabel("Type d’opération", { exact: true });
  await tabTo(kind); await page.keyboard.press("Home"); await page.keyboard.press("ArrowDown"); await page.keyboard.press("Tab");
  assert.equal(await kind.inputValue(), "withdrawal");
  await tabTo(accountSelect); await page.keyboard.press("End"); await page.keyboard.press("Tab");
  await type(amount, "300");
  await activate(button("Enregistrer l’opération"));
  await page.getByRole("alert").waitFor();
  assert.equal(await amount.inputValue(), "300", "Recoverable errors must preserve the draft");
  assert.equal((await operations()).length, 2, "Rejected withdrawal must not persist");
  let audits = 0;
  for (const theme of ["dark", "light"]) {
    const selector = page.getByLabel("Thème", { exact: false });
    await tabTo(selector);
    await page.keyboard.press(theme === "light" ? "End" : "Home");
    if (theme === "dark") await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Tab");
    assert.equal(await selector.inputValue(), theme);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Long names must not cause horizontal overflow");
      const scan = await new AxeBuilder({ page }).analyze();
      assert.deepEqual(scan.violations.map(v => ({ id: v.id, impact: v.impact })), []);
      audits++;
    }
  }
  assert.equal(await amount.inputValue(), "300");
  await type(amount, "50");
  await activate(button("Enregistrer l’opération"));
  await page.getByText("Enregistrement confirmé.", { exact: true }).waitFor();
  assert.equal((await operations()).length, 3);
  const summary = await (await context.request.get(`${origin}/api/v1/summary`)).json();
  assert.equal(summary.total_value_eur.exact, "150");
  assert.equal(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches), true);
  assert.equal(await page.evaluate(() => document.getAnimations({ subtree: true }).filter(a => a.playState === "running").length), 0);
  assert.deepEqual(errors, []);
  await context.close();
  console.log(`PASS: keyboard-only signup, portfolio/account, long names, deposit duplication with explicit save, rejected withdrawal draft preserved then repaired; ${audits} axe scans; reduced-motion preference. Real PostgreSQL; not a screen-reader certification.`);
} finally { await browser.close(); }
