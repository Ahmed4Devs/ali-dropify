import assert from "node:assert/strict";
import test from "node:test";

import { isSupportedShippingCountry } from "../lib/shipping-destination";

test("accepts Saudi Arabia in common English, Arabic, and ISO forms", () => {
  for (const country of ["SA", "Saudi Arabia", "Kingdom of Saudi Arabia", "السعودية", "المملكة العربية السعودية"]) {
    assert.equal(isSupportedShippingCountry(country), true, country);
  }
});

test("rejects destinations without configured shipping coverage", () => {
  for (const country of ["", "United Arab Emirates", "Australia", "SAUDI ARABIA, UAE"]) {
    assert.equal(isSupportedShippingCountry(country), false, country);
  }
});
