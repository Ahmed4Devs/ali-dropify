import assert from "node:assert/strict";
import test from "node:test";

import {
  availableInventory,
  isInventoryAvailable,
  type InventoryCartLine,
} from "../lib/inventory-availability";

function line(overrides: Partial<InventoryCartLine> = {}): InventoryCartLine {
  return {
    id: "line-1",
    quantity: 2,
    product: {
      id: "product-1",
      inStock: true,
      trackInventory: true,
      stockQuantity: 10,
      reservedQuantity: 3,
    },
    variant: null,
    ...overrides,
  };
}

test("subtracts active reservations from tracked stock", () => {
  assert.equal(availableInventory(line()), 7);
  assert.equal(isInventoryAvailable(line({ quantity: 7 })), true);
  assert.equal(isInventoryAvailable(line({ quantity: 8 })), false);
});

test("uses variant inventory when a variant is selected", () => {
  const variant = {
    id: "variant-1",
    inStock: true,
    trackInventory: true,
    stockQuantity: 4,
    reservedQuantity: 1,
  };
  assert.equal(availableInventory(line({ variant })), 3);
});

test("respects manual availability when inventory tracking is disabled", () => {
  const product = {
    id: "product-1",
    inStock: true,
    trackInventory: false,
    stockQuantity: 0,
    reservedQuantity: 0,
  };
  assert.equal(availableInventory(line({ product, quantity: 20 })), Infinity);
  assert.equal(isInventoryAvailable(line({ product, quantity: 20 })), true);
});

test("a disabled product cannot be made available by its variant", () => {
  const product = { ...line().product, inStock: false };
  const variant = { ...line().product, id: "variant-1", inStock: true };
  assert.equal(availableInventory(line({ product, variant })), 0);
});

test("a draft product cannot be purchased even when inventory is available", () => {
  const product = { ...line().product, isPublished: false };
  assert.equal(availableInventory(line({ product })), 0);
});
