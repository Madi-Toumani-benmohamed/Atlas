import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { emptyResponse } from "./mock-data.mjs";
const browser = await chromium.launch({
  ...(process.env.ATLAS_CHROMIUM
    ? { executablePath: process.env.ATLAS_CHROMIUM }
    : {}),
  headless: true,
});
const findings = [];
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  let session = false;
  await page.route("**/api/v1/**", (r) => {
    const empty = emptyResponse(new URL(r.request().url()).pathname);
    return r.fulfill({
      status: empty ? 200 : session ? 200 : 401,
      contentType: "application/json",
      body: JSON.stringify(
        empty ||
          (session ? { id: "synthetic", email: "synthetic@example.test" } : {}),
      ),
    });
  });
  for (const theme of ["dark", "light"]) {
    for (const viewport of [
      { width: 1440, height: 960 },
      { width: 320, height: 740 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(process.env.ATLAS_A11Y_ORIGIN || "http://127.0.0.1:5173");
      await page
        .getByRole("heading", { name: "Se connecter", exact: true })
        .waitFor();
      await page.getByLabel("Thème").selectOption(theme);
      for (const state of ["login", "register", "authenticated"]) {
        if (state === "register")
          await page
            .getByRole("button", { name: "Créer un compte", exact: true })
            .click();
        if (state === "authenticated") {
          session = true;
          await page.reload();
          await page
            .getByRole("heading", { name: "Bienvenue dans Atlas" })
            .waitFor();
        }
        const result = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
          .analyze();
        findings.push({
          theme,
          width: viewport.width,
          state,
          violations: result.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            nodes: v.nodes.map((n) => ({
              target: n.target,
              summary: n.failureSummary,
            })),
          })),
        });
      }
      session = false;
    }
  }
  console.log(JSON.stringify(findings, null, 2));
  // Responses are simulated: this suite tests rendered semantics and contrast.
  assert.ok(
    findings.every((f) => f.violations.length === 0),
    "Accessibility violations found",
  );
} finally {
  await browser.close();
}
