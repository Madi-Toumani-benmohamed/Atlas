import { chromium } from "playwright";
import assert from "node:assert/strict";
import { emptyResponse } from "./mock-data.mjs";
const browser = await chromium.launch({
  ...(process.env.ATLAS_CHROMIUM
    ? { executablePath: process.env.ATLAS_CHROMIUM }
    : {}),
  headless: true,
});
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let session = false,
    failure = "",
    meFailure = false;
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const empty = emptyResponse(path);
    if (empty)
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(empty),
      });
    const respond = (status, data) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    if (path.endsWith("/me"))
      return respond(
        meFailure ? 503 : session ? 200 : 401,
        session ? { id: "synthetic", email: "synthetic@example.test" } : {},
      );
    if (path.endsWith("/register"))
      return respond(failure === "register" ? 403 : 202, {});
    if (path.endsWith("/login")) {
      if (failure === "login") return respond(401, {});
      session = true;
      return respond(200, {});
    }
    if (path.endsWith("/logout")) {
      if (failure === "logout") return respond(503, {});
      session = false;
      return route.fulfill({ status: 204 });
    }
    throw Error(path);
  });
  await page.goto("http://127.0.0.1:5173");
  await page
    .getByRole("heading", { name: "Se connecter", exact: true })
    .waitFor();
  await page.getByLabel("Adresse e-mail").fill("synthetic@example.test");
  await page
    .getByLabel("Mot de passe", { exact: true })
    .fill("synthetic-password");
  failure = "login";
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "incorrect" }).waitFor();
  assert.equal(
    await page.getByLabel("Adresse e-mail").inputValue(),
    "synthetic@example.test",
  );
  assert.equal(
    await page.getByLabel("Mot de passe", { exact: true }).inputValue(),
    "synthetic-password",
  );
  failure = "";
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page.getByRole("heading", { name: "Bienvenue dans Atlas" }).waitFor();
  assert.equal(await page.locator("input[type=password]").count(), 0);
  await page.reload();
  await page.getByRole("heading", { name: "Bienvenue dans Atlas" }).waitFor();
  failure = "logout";
  await page
    .getByRole("button", { name: "Se déconnecter", exact: true })
    .click();
  await page.getByRole("alert").waitFor();
  await page.getByRole("heading", { name: "Bienvenue dans Atlas" }).waitFor();
  failure = "";
  await page
    .getByRole("button", { name: "Se déconnecter", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Se connecter", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Créer un compte", exact: true })
    .click();
  assert.equal(await page.locator(":focus").getAttribute("id"), "panel-title");
  await page.getByLabel("Adresse e-mail").fill("synthetic@example.test");
  await page.getByLabel("Mot de passe", { exact: true }).fill("é".repeat(37));
  await page.getByRole("button", { name: "Demander l’inscription" }).click();
  await page.getByRole("alert").filter({ hasText: "12 à 72 octets" }).waitFor();
  await page
    .getByLabel("Mot de passe", { exact: true })
    .fill("synthetic-password");
  failure = "register";
  await page.getByRole("button", { name: "Demander l’inscription" }).click();
  await page.getByRole("alert").filter({ hasText: "désactivée" }).waitFor();
  failure = "";
  await page.getByRole("button", { name: "Demander l’inscription" }).click();
  await page.getByRole("status").filter({ hasText: "Demande reçue" }).waitFor();
  assert.equal(
    await page.getByLabel("Mot de passe", { exact: true }).inputValue(),
    "",
  );
  meFailure = true;
  await page.reload();
  await page.getByRole("alert").waitFor();
  meFailure = false;
  await page.getByRole("button", { name: "Revérifier ma session" }).click();
  await page
    .getByRole("heading", { name: "Se connecter", exact: true })
    .waitFor();
  for (const [width, height] of [
    [1440, 960],
    [390, 844],
    [320, 740],
  ]) {
    await page.setViewportSize({ width, height });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  await page.getByLabel("Thème").selectOption("light");
  assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
  await page.reload();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
  await page
    .getByRole("heading", { name: "Se connecter", exact: true })
    .waitFor();
  await page.getByLabel("Adresse e-mail").focus();
  await page.keyboard.press("Tab");
  assert.equal(await page.locator(":focus").getAttribute("id"), "password");
  assert.deepEqual(errors, []);
  console.log(
    "PASS: auth UI flows, UTF-8 limits, errors, focus, theme persistence and 3 viewports. API responses simulated.",
  );
} finally {
  await browser.close();
}
