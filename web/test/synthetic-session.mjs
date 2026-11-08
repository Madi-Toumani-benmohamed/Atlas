import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as pause } from "node:timers/promises";

// Only authentication is retried, before financial fixtures are created.
export async function syntheticSession(context, origin, prefix, wait = pause) {
  if (process.env.ATLAS_E2E_TEST_INSTANCE !== "true") throw Error("Dedicated synthetic test instance required");
  const credentials = { email: `${prefix}-${randomUUID()}@example.test`, password: `Synthetic-${randomUUID()}` };
  for (const [path, expected] of [["register", 202], ["login", 200]]) {
    for (let attempt = 0; ; attempt++) {
      const response = await context.request.post(`${origin}/api/v1/auth/${path}`, {
        data: credentials, headers: { Origin: origin },
      });
      if (response.status() !== 429 || attempt === 2) {
        assert.equal(response.status(), expected, `Synthetic ${path} failed`);
        break;
      }
      const retry = response.headers()["retry-after"];
      if (!/^[1-9][0-9]?$/.test(retry || "") || Number(retry) > 60)
        throw Error("Unsupported Retry-After on synthetic authentication");
      console.log("Synthetic authentication rate limited; respecting Retry-After.");
      await wait(Number(retry) * 1000);
    }
  }
}
