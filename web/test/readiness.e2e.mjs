import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { setTimeout as pause } from "node:timers/promises";
const origin = process.env.ATLAS_E2E_API_ORIGIN;
const database = process.env.ATLAS_E2E_DATABASE_CONTAINER;
const healthcheck = process.env.ATLAS_E2E_HEALTHCHECK;
if (
  process.env.ATLAS_E2E_TEST_INSTANCE !== "true" ||
  !origin ||
  !database ||
  !healthcheck
)
  throw Error(
    "Dedicated test API, database container and healthcheck binary required",
  );
async function probe(path) {
  const response = await fetch(origin + path, {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(2000),
  });
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.json();
  assert.deepEqual(Object.keys(body), ["status"]);
  return { status: response.status, body };
}
async function waitForReady(expected) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const response = await probe("/readyz");
      if (response.status === expected) {
        assert.equal(
          response.body.status,
          expected === 200 ? "ok" : "unavailable",
        );
        return;
      }
    } catch {
      /* Startup/recovery can briefly interrupt the socket. */
    }
    await pause(250);
  }
  throw Error(`Readiness did not reach ${expected}`);
}
function command(path) {
  return spawnSync(healthcheck, [], {
    env: { ...process.env, ATLAS_HEALTHCHECK_PATH: path },
    timeout: 4000,
    encoding: "utf8",
  }).status;
}
await waitForReady(200);
assert.equal(command("/readyz"), 0);
assert.equal(command("/healthz"), 0);
assert.equal(command("http://external.invalid"), 1);
try {
  execFileSync("docker", ["stop", database], { timeout: 15000, stdio: "pipe" });
  await waitForReady(503);
  assert.equal((await probe("/healthz")).status, 200);
  assert.equal(command("/readyz"), 1);
  assert.equal(command("/healthz"), 0);
} finally {
  execFileSync("docker", ["start", database], {
    timeout: 15000,
    stdio: "pipe",
  });
}
await waitForReady(200);
assert.equal(command("/readyz"), 0);
console.log(
  "PASS: real PostgreSQL stop/restart changes readiness 200→503→200 while liveness stays 200; local healthcheck honors selected path and rejects invalid destinations.",
);
