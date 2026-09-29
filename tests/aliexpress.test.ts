import assert from "node:assert/strict";
import test from "node:test";

import { parseAliExpressProductUrl } from "../lib/aliexpress";

test("extracts the supplier product ID and removes tracking parameters", () => {
  assert.deepEqual(
    parseAliExpressProductUrl("https://www.aliexpress.com/item/1005001234567890.html?spm=abc&sku_id=123"),
    {
      productId: "1005001234567890",
      url: "https://www.aliexpress.com/item/1005001234567890.html",
    },
  );
});

test("rejects non-item, insecure, and lookalike supplier URLs", () => {
  for (const url of [
    "https://www.aliexpress.com/",
    "http://www.aliexpress.com/item/123.html",
    "https://www.aliexpress.com.evil.test/item/123.html",
    "https://aliexpress.com@evil.test/item/123.html",
    "https://www.aliexpress.com/item/0.html",
  ]) {
    assert.equal(parseAliExpressProductUrl(url), null, url);
  }
});
