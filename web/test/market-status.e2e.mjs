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
  const context = await browser.newContext({ locale: "fr-FR" });
  const credentials = {
    email: `operational-${randomUUID()}@example.test`,
    password: `Synthetic-${randomUUID()}`,
  };
  for (const [path, status] of [
    ["register", 202],
    ["login", 200],
  ]) {
    const r = await context.request.post(`${origin}/api/v1/auth/${path}`, {
      data: credentials,
      headers: { Origin: origin },
    });
    assert.equal(r.status(), status);
  }
  const publicProbe = await browser.newContext();
  assert.equal(
    (await publicProbe.request.get(`${origin}/api/v1/market/status`)).status(),
    401,
  );
  await publicProbe.close();
  const actual = await context.request.get(`${origin}/api/v1/market/status`);
  assert.equal(actual.status(), 200);
  assert.equal(actual.headers()["cache-control"], "no-store");
  const snapshot = await actual.json();
  assert.equal(snapshot.provider.source, "ECB");
  assert.equal(snapshot.synchronization.last_persisted_at, null);
  assert.equal(snapshot.automatic_asset_prices, false);
  assert.ok(!JSON.stringify(snapshot).includes(credentials.email));
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  await page.goto(origin);
  await page.getByRole("button", { name: "Activité", exact: true }).click();
  let calls = 0;
  // Synthetic operational fixture for deterministic UI states; the actual private API was checked above.
  await page.route("**/api/v1/market/status", (route) => {
    calls++;
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        provider: {
          source: "ECB",
          state: calls === 1 ? "never_fetched" : "backoff",
          last_success_at: null,
          next_request_at: calls === 1 ? null : "2026-11-07T12:00:00Z",
          last_error_code: calls === 1 ? undefined : "ecb_rate_limited",
        },
        synchronization: { last_persisted_at: null, reference_date: "" },
      }),
    });
  });
  await page.getByText("État de la récupération BCE", { exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Aucune réponse BCE récupérée depuis le démarrage." })
    .waitFor();
  await page
    .getByRole("button", { name: "Vérifier l’état BCE", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Nouvelle tentative BCE temporairement différée." })
    .waitFor();
  await page
    .getByText(
      "Le fournisseur limite les requêtes. Les taux déjà enregistrés restent inchangés.",
      { exact: true },
    )
    .waitFor();
  assert.equal(calls, 2);
  for (const theme of ["dark", "light"]) {
    await page.getByLabel("Thème").selectOption(theme);
    for (const width of [1440, 320]) {
      await page.setViewportSize({ width, height: 900 });
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      assert.deepEqual(
        result.violations.map((v) => ({
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
  if (process.env.ATLAS_E2E_SCREENSHOT_DIR) {
    await mkdir(process.env.ATLAS_E2E_SCREENSHOT_DIR, { recursive: true });
    await page
      .getByText("État de la récupération BCE", { exact: true })
      .evaluate((el) => el.scrollIntoView({ block: "start" }));
    await page.screenshot({
      path: `${process.env.ATLAS_E2E_SCREENSHOT_DIR}/market-status-mobile.png`,
    });
  }
  await context.close();
  console.log(
    "PASS: private operational API, no cross-user persistence exposed; provider never-fetched/backoff UI states and 4 accessibility scans using explicit synthetic operational fixtures.",
  );
} finally {
  await browser.close();
}
