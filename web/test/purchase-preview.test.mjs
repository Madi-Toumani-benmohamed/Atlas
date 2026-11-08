import { test } from "node:test";
import assert from "node:assert/strict";
import { purchasePreview } from "../src/purchase-preview.ts";

test("approved purchase formulas produce exact quantities and fee-inclusive totals", () => {
  const cases = [
    [{ amount: "1000", price: "100", fees: "20" }, true, "49/5", "1000", "9.80000000", false],
    [{ amount: "1", price: "3" }, true, "1/3", "1", "0.33333333", true],
    [{ amount: "0,3", price: "0,1", fees: "0,1" }, true, "2", "3/10", "2.00000000", false],
    [{ quantity: "3", price: "100", fees: "2" }, false, "3", "302", "3.00000000", false],
    [{ quantity: "1/3", price: "3", fees: "0.01" }, false, "1/3", "101/100", "0.33333333", true],
    [{ amount: "1000000000000000000", price: "0.000000000000000001" }, true, "1" + "0".repeat(36), "1000000000000000000", "1" + "0".repeat(36) + ".00000000", false],
  ];
  for (const [fields, byTotal, quantity, total, display, approximate] of cases) {
    const result = purchasePreview(fields, byTotal);
    assert.equal(result.state, "ready");
    assert.equal(result.quantity.exact, quantity);
    assert.equal(result.total.exact, total);
    assert.equal(result.quantity.display, display);
    assert.equal(result.quantity.approximate, approximate);
  }
});

test("rounding is only presentation and exact rational remains available", () => {
  const r = purchasePreview({ quantity: "1/6", price: "1" }, false);
  assert.equal(r.quantity.exact, "1/6");
  assert.equal(r.quantity.display, "0.16666667");
  assert.equal(r.total.exact, "1/6");
  assert.equal(r.total.display, "0.17");
  assert.equal(r.total.approximate, true);
});

test("incomplete and invalid input never produce a plausible purchase", () => {
  assert.equal(purchasePreview({}, true).state, "incomplete");
  for (const fields of [
    {amount:"1",price:"0"}, {amount:"0",price:"1"},
    {amount:"1",price:"1",fees:"1"}, {amount:"1",price:"1",fees:"2"},
    {amount:"1",price:"1",fees:"-1"}, {amount:"1e3",price:"1"},
    {amount:"01",price:"1"}, {amount:"1",price:"0.0000000000000000001"},
    {amount:"9".repeat(37),price:"1"}, {amount:"Infinity",price:"1"},
  ]) assert.equal(purchasePreview(fields,true).state,"invalid");
  for (const quantity of ["1/0", "010/1", "-1", "1e36", "9".repeat(8191)])
    assert.equal(purchasePreview({quantity,price:"1"},false).state,"invalid");
});
