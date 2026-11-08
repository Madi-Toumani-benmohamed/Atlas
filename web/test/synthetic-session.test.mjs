import { test } from "node:test";
import assert from "node:assert/strict";
import { syntheticSession } from "./synthetic-session.mjs";

test("synthetic authentication honors Retry-After before retrying and keeps credentials out of URLs", async () => {
  process.env.ATLAS_E2E_TEST_INSTANCE = "true";
  const waits = [], calls = [], statuses = [429, 202, 200];
  const context = {request:{post:async(url, options)=>{
    calls.push({url,options});
    const status=statuses.shift();
    return {status:()=>status,headers:()=>({"retry-after":"60"})};
  }}};
  await syntheticSession(context,"https://atlas.test","synthetic",async ms=>waits.push(ms));
  assert.deepEqual(waits,[60000]);
  assert.equal(calls.length,3);
  assert.ok(calls.every(c=>!c.url.includes(c.options.data.password)));
  assert.deepEqual(calls[0].options.data,calls[1].options.data);
  assert.ok(calls[2].url.endsWith('/auth/login'));
});

test("fixture bootstrap does not retry a non-rate-limit error or invalid retry policy", async () => {
  process.env.ATLAS_E2E_TEST_INSTANCE = "true";
  for (const [status, retry] of [[503,"60"],[429,undefined],[429,"0"],[429,"61"]]) {
    let calls=0;
    const context={request:{post:async()=>{calls++;return {status:()=>status,headers:()=>({"retry-after":retry})};}}};
    await assert.rejects(syntheticSession(context,"https://atlas.test","synthetic",async()=>assert.fail("must not wait")));
    assert.equal(calls,1);
  }
});

test("fixture bootstrap bounds repeated throttling and requires a dedicated instance", async () => {
  process.env.ATLAS_E2E_TEST_INSTANCE = "true";
  let calls=0, waits=0;
  const context={request:{post:async()=>{calls++;return {status:()=>429,headers:()=>({"retry-after":"1"})};}}};
  await assert.rejects(syntheticSession(context,"https://atlas.test","synthetic",async()=>{waits++;}));
  assert.equal(calls,3); assert.equal(waits,2);
  delete process.env.ATLAS_E2E_TEST_INSTANCE;
  await assert.rejects(syntheticSession(context,"https://atlas.test","synthetic"));
  assert.equal(calls,3);
});
