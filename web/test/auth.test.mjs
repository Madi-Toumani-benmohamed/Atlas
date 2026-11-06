import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError, createAuthClient, errorMessage } from "../src/auth.ts";

test("session is private, uncached and only a 401 becomes anonymous", async () => {
  for (const status of [401, 403, 404, 429, 503]) {
    const client = createAuthClient(async (url, options) => {
      assert.equal(url, "/api/v1/me");
      assert.equal(options.credentials, "same-origin");
      assert.equal(options.cache, "no-store");
      assert.equal(options.redirect, "error");
      return new Response("", { status });
    });
    if (status === 401) assert.equal(await client.me(), null);
    else
      await assert.rejects(
        client.me(),
        (error) => error instanceof ApiError && error.status === status,
      );
  }
});

test("only validated identity fields are exposed", async () => {
  const client = createAuthClient(async () =>
    Response.json({
      id: "synthetic",
      email: "test@example.test",
      password: "never expose",
    }),
  );
  assert.deepEqual(await client.me(), {
    id: "synthetic",
    email: "test@example.test",
  });
  for (const data of [null, {}, { id: 123, email: "test@example.test" }]) {
    await assert.rejects(
      createAuthClient(async () => Response.json(data)).me(),
    );
  }
});

test("writes use the existing API and never send credentials in a URL", async () => {
  const calls = [];
  const client = createAuthClient(async (url, options) => {
    calls.push({ url, options });
    return new Response(null, { status: url.endsWith("logout") ? 204 : 202 });
  });
  const credentials = {
    email: "synthetic@example.test",
    password: "synthetic-password",
  };
  await client.register(credentials);
  await client.login(credentials);
  await client.logout();
  assert.deepEqual(
    calls.map((call) => call.url),
    ["/api/v1/auth/register", "/api/v1/auth/login", "/api/v1/auth/logout"],
  );
  for (const { options } of calls) assert.equal(options.method, "POST");
  assert.equal(calls[0].options.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(calls[1].options.body), credentials);
  assert.equal(calls[2].options.body, undefined);
});

test("network failure and rejected logout propagate rather than report success", async () => {
  const offline = createAuthClient(async () => {
    throw new TypeError("offline");
  });
  await assert.rejects(offline.me());
  await assert.rejects(
    offline.login({
      email: "test@example.test",
      password: "synthetic-password",
    }),
  );
  await assert.rejects(
    createAuthClient(async () => new Response("", { status: 503 })).logout(),
  );
});

test("error messages cover disabled registration, rate limits and missing service", () => {
  assert.match(errorMessage(new ApiError(403), "register"), /désactivée/);
  assert.match(errorMessage(new ApiError(429), "login"), /minute/);
  assert.match(errorMessage(new ApiError(404), "session"), /pas activé/);
  assert.match(errorMessage(new ApiError(401), "login"), /incorrect/);
});
