export type InventoryTarget = {
  id: string;
  inStock: boolean;
  trackInventory: boolean;
  stockQuantity: number;
  reservedQuantity: number;
};

export type InventoryCartLine = {
  id: string;
  quantity: number;
  product: InventoryTarget;
  variant: InventoryTarget | null;
};

export function availableInventory(line: InventoryCartLine) {
  const target = line.variant ?? line.product;
  if (!line.product.inStock || !target.inStock) return 0;
  if (!target.trackInventory) return Number.POSITIVE_INFINITY;
  return Math.max(0, target.stockQuantity - target.reservedQuantity);
}

export function isInventoryAvailable(line: InventoryCartLine) {
  return availableInventory(line) >= line.quantity;
}
