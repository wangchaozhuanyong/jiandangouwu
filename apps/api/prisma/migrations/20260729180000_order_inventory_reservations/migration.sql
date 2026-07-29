ALTER TABLE `Order`
  ADD COLUMN `inventoryReserved` BOOLEAN NOT NULL DEFAULT false AFTER `reservedUntil`,
  ADD COLUMN `inventoryReleasedAt` DATETIME(3) NULL AFTER `inventoryReserved`;

CREATE INDEX `Order_inventory_expiry_idx`
  ON `Order`(`status`, `inventoryReserved`, `inventoryReleasedAt`, `reservedUntil`);
