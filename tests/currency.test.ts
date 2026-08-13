import assert from "node:assert/strict";
import test from "node:test";

import { convertFromUsd, getCurrencyRate } from "../lib/currency";

test("uses the configured minor-unit exchange rates", () => {
  assert.equal(convertFromUsd(1_000, "USD"), 1_000);
  assert.equal(convertFromUsd(1_000, "SAR"), 3_750);
  assert.equal(convertFromUsd(1_000, "AUD"), 1_550);
});

test("honors admin-provided exchange rates", () => {
  const rates = { USD: 1, SAR: 3.8, AUD: 1.6 } as const;
  assert.equal(convertFromUsd(2_499, "SAR", rates), 9_496);
  assert.equal(convertFromUsd(2_499, "AUD", rates), 3_998);
});

test("returns the selected checkout rate", () => {
  assert.equal(getCurrencyRate("USD", 4, 2), 1);
  assert.equal(getCurrencyRate("SAR", 4, 2), 4);
  assert.equal(getCurrencyRate("AUD", 4, 2), 2);
});
