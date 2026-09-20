import assert from "node:assert/strict";
import test from "node:test";

import { decimalToMinorUnits } from "../lib/payments/amounts";

test("converts provider decimal amounts without floating-point rounding", () => {
  assert.equal(decimalToMinorUnits("10"), 1000);
  assert.equal(decimalToMinorUnits("10.5"), 1050);
  assert.equal(decimalToMinorUnits("10.05"), 1005);
});

test("rejects malformed or over-precise provider amounts", () => {
  for (const value of ["", "-1", "1.001", "1e3", "1.", "NaN"]) {
    assert.equal(decimalToMinorUnits(value), null);
  }
});
