import { chromium } from "playwright";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Explicit opt-in: this suite creates synthetic users in a dedicated instance.
const origin = process.env.ATLAS_E2E_ORIGIN;
if (!origin || process.env.ATLAS_E2E_TEST_INSTANCE !== "true") {
  throw new Error(
    "Use a dedicated test database/API with registration enabled; set ATLAS_E2E_ORIGIN and ATLAS_E2E_TEST_INSTANCE=true.",
  );
}
const url = new URL(origin);
if (url.origin !== origin || !["http:", "https:"].includes(url.protocol)) {
  throw new Error(
    "ATLAS_E2E_ORIGIN must be an exact HTTP(S) origin without a trailing slash.",
  );
}
const browser = await chromium.launch({
  ...(process.env.ATLAS_CHROMIUM
    ? { executablePath: process.env.ATLAS_CHROMIUM }
    : {}),
  headless: true,
});
try {
  // Wait for both the web server and its real API proxy, without creating users.
  const probe = await browser.newContext();
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const [web, api] = await Promise.all([
        probe.request.get(origin, { timeout: 1000 }),
        probe.request.get(`${origin}/api/v1/me`, { timeout: 1000 }),
      ]);
      if (web.ok() && api.status() === 401) {
        ready = true;
        break;
      }
    } catch {
      /* Development services may still be starting. */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  await probe.close();
  assert.ok(
    ready,
    "Test frontend and identity API must be reachable through the same origin",
  );
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
  ]);
  const pages = await Promise.all(contexts.map((context) => context.newPage()));
  const emails = [0, 1].map(() => `e2e-${randomUUID()}@example.test`);
  const password = `Synthetic-${randomUUID()}`;
  const errors = [];
  for (const page of pages) {
    page.setDefaultTimeout(15000);
    page.on("pageerror", (error) => errors.push(error.message));
  }
  async function login(page, email) {
    await page.getByLabel("Adresse e-mail").fill(email);
    await page.getByLabel("Mot de passe", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "Se connecter", exact: true })
      .click();
    await page.getByRole("heading", { name: "Bienvenue dans Atlas" }).waitFor();
    assert.equal(await page.locator(".email").innerText(), email);
  }
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    await page.goto(origin);
    await page
      .getByRole("button", { name: "Créer un compte", exact: true })
      .click();
    await page.getByLabel("Adresse e-mail").fill(emails[i]);
    await page.getByLabel("Mot de passe", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Demander l’inscription" }).click();
    await page
      .getByRole("status")
      .filter({ hasText: "Demande reçue" })
      .waitFor();
    await login(page, emails[i]);
    const cookie = (await contexts[i].cookies()).find(
      (item) =>
        item.name ===
        (url.protocol === "https:" ? "__Host-atlas_session" : "atlas_session"),
    );
    assert.ok(cookie?.httpOnly);
    assert.equal(cookie.sameSite, "Strict");
    assert.equal(cookie.secure, url.protocol === "https:");
    await page.reload();
    await page.getByRole("heading", { name: "Bienvenue dans Atlas" }).waitFor();
  }

  if (url.protocol === "https:") {
    const b = (await contexts[1].cookies()).find(
      (c) => c.name === "__Host-atlas_session",
    );
    await contexts[0].addCookies([
      {
        name: "atlas_session",
        value: b.value,
        domain: url.hostname,
        path: "/api",
        secure: true,
        httpOnly: true,
        sameSite: "Strict",
      },
    ]);
    await pages[0].reload();
    await pages[0]
      .getByRole("heading", { name: "Bienvenue dans Atlas" })
      .waitFor();
    assert.equal(await pages[0].locator(".email").innerText(), emails[0]);
  }
  // Altering a user parameter never changes the owner of the session.
  for (let i = 0; i < pages.length; i++) {
    const data = await pages[i].evaluate(async () => {
      const response = await fetch("/api/v1/me?user_id=another-user", {
        cache: "no-store",
      });
      return { status: response.status, body: await response.json() };
    });
    assert.equal(data.status, 200);
    assert.equal(data.body.email, emails[i]);
  }
  // An independent second browser for A rotates A's first session, not B's.
  const rotated = await browser.newContext();
  const rotatedPage = await rotated.newPage();
  rotatedPage.setDefaultTimeout(15000);
  await rotatedPage.goto(origin);
  await login(rotatedPage, emails[0]);
  await pages[0].reload();
  await pages[0]
    .getByRole("heading", { name: "Se connecter", exact: true })
    .waitFor();
  await pages[1].reload();
  await pages[1]
    .getByRole("heading", { name: "Bienvenue dans Atlas" })
    .waitFor();
  assert.equal(await pages[1].locator(".email").innerText(), emails[1]);
  const denied = await rotated.request.post(`${origin}/api/v1/auth/logout`, {
    headers: { Origin: "https://foreign.example.test" },
  });
  assert.equal(denied.status(), 403);
  await rotatedPage.reload();
  await rotatedPage
    .getByRole("heading", { name: "Bienvenue dans Atlas" })
    .waitFor();
  await rotatedPage
    .getByRole("button", { name: "Se déconnecter", exact: true })
    .click();
  await rotatedPage
    .getByRole("heading", { name: "Se connecter", exact: true })
    .waitFor();
  assert.equal(
    (await rotated.request.get(`${origin}/api/v1/me`)).status(),
    401,
  );
  await rotatedPage.getByLabel("Adresse e-mail").fill(emails[0]);
  await rotatedPage
    .getByLabel("Mot de passe", { exact: true })
    .fill("synthetic-wrong-password");
  await rotatedPage
    .getByRole("button", { name: "Se connecter", exact: true })
    .click();
  await rotatedPage
    .getByRole("alert")
    .filter({ hasText: "incorrect" })
    .waitFor();
  await pages[1]
    .getByRole("button", { name: "Se déconnecter", exact: true })
    .click();
  await pages[1]
    .getByRole("heading", { name: "Se connecter", exact: true })
    .waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: real browser → API → PostgreSQL; registration, login, cookie, reload, two-user isolation, rotation, CSRF and logout.",
  );
} finally {
  await browser.close();
}
