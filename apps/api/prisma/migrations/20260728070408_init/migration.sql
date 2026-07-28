-- CreateTable
CREATE TABLE `Category` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(120) NOT NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Category_slug_key`(`slug`),
    INDEX `Category_status_sortOrder_idx`(`status`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CategoryTranslation` (
    `id` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `locale` ENUM('ZH', 'EN') NOT NULL,
    `name` VARCHAR(160) NOT NULL,

    INDEX `CategoryTranslation_locale_name_idx`(`locale`, `name`),
    UNIQUE INDEX `CategoryTranslation_categoryId_locale_key`(`categoryId`, `locale`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Product` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(160) NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `imageKey` VARCHAR(512) NOT NULL,
    `basePrice` DECIMAL(18, 2) NOT NULL,
    `compareAtPrice` DECIMAL(18, 2) NULL,
    `stockMode` ENUM('FINITE', 'UNLIMITED') NOT NULL DEFAULT 'FINITE',
    `stockQuantity` INTEGER NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Product_slug_key`(`slug`),
    INDEX `Product_categoryId_status_sortOrder_idx`(`categoryId`, `status`, `sortOrder`),
    INDEX `Product_status_sortOrder_idx`(`status`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductTranslation` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `locale` ENUM('ZH', 'EN') NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `normalizedName` VARCHAR(220) NOT NULL,
    `kicker` VARCHAR(180) NOT NULL,
    `description` TEXT NOT NULL,
    `aliases` JSON NULL,

    INDEX `ProductTranslation_locale_normalizedName_idx`(`locale`, `normalizedName`),
    UNIQUE INDEX `ProductTranslation_productId_locale_key`(`productId`, `locale`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Hero` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(80) NOT NULL,
    `imageKey` VARCHAR(512) NOT NULL,
    `targetSlug` VARCHAR(160) NULL,
    `tone` VARCHAR(40) NOT NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Hero_key_key`(`key`),
    INDEX `Hero_status_sortOrder_idx`(`status`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HeroTranslation` (
    `id` VARCHAR(191) NOT NULL,
    `heroId` VARCHAR(191) NOT NULL,
    `locale` ENUM('ZH', 'EN') NOT NULL,
    `eyebrow` VARCHAR(160) NOT NULL,
    `title` VARCHAR(300) NOT NULL,
    `body` TEXT NOT NULL,
    `cta` VARCHAR(120) NOT NULL,

    UNIQUE INDEX `HeroTranslation_heroId_locale_key`(`heroId`, `locale`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Currency` (
    `code` CHAR(4) NOT NULL,
    `token` VARCHAR(12) NOT NULL,
    `nameZh` VARCHAR(120) NOT NULL,
    `nameEn` VARCHAR(120) NOT NULL,
    `digits` INTEGER NOT NULL DEFAULT 2,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Currency_active_sortOrder_idx`(`active`, `sortOrder`),
    PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExchangeRate` (
    `id` VARCHAR(191) NOT NULL,
    `fromCode` CHAR(4) NOT NULL,
    `toCode` CHAR(4) NOT NULL,
    `rate` DECIMAL(24, 10) NOT NULL,
    `source` VARCHAR(120) NOT NULL,
    `effectiveAt` DATETIME(3) NOT NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ExchangeRate_fromCode_toCode_effectiveAt_idx`(`fromCode`, `toCode`, `effectiveAt`),
    UNIQUE INDEX `ExchangeRate_fromCode_toCode_effectiveAt_key`(`fromCode`, `toCode`, `effectiveAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MerchantChannel` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('WHATSAPP', 'EMAIL', 'TELEGRAM', 'WECHAT', 'QQ') NOT NULL,
    `mode` ENUM('DIRECT_LINK', 'DIRECT_WITH_FALLBACK', 'QR_COPY') NOT NULL,
    `labelZh` VARCHAR(80) NOT NULL,
    `labelEn` VARCHAR(80) NOT NULL,
    `publicAccount` VARCHAR(240) NOT NULL,
    `directTarget` VARCHAR(512) NULL,
    `serviceHours` VARCHAR(120) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MerchantChannel_type_key`(`type`),
    INDEX `MerchantChannel_active_sortOrder_idx`(`active`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Order` (
    `id` VARCHAR(191) NOT NULL,
    `orderNumber` VARCHAR(32) NOT NULL,
    `idempotencyKey` VARCHAR(120) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `productNameSnapshot` VARCHAR(200) NOT NULL,
    `currencyCode` CHAR(4) NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `referenceCurrencyCode` CHAR(4) NULL,
    `referenceAmount` DECIMAL(18, 2) NULL,
    `exchangeRateSnapshot` DECIMAL(24, 10) NOT NULL,
    `productVersion` INTEGER NOT NULL,
    `contactChannel` ENUM('WHATSAPP', 'EMAIL', 'TELEGRAM', 'WECHAT', 'QQ') NOT NULL,
    `contactEncrypted` TEXT NOT NULL,
    `contactHash` CHAR(64) NOT NULL,
    `maskedContact` VARCHAR(240) NOT NULL,
    `acceptedPolicyVersion` VARCHAR(80) NOT NULL,
    `status` ENUM('MANUAL_PENDING', 'CONTACTED', 'AWAITING_PAYMENT', 'PAYMENT_PROCESSING', 'PAID', 'FULFILLING', 'COMPLETED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED', 'DISPUTED') NOT NULL DEFAULT 'MANUAL_PENDING',
    `paymentMode` ENUM('MANUAL') NOT NULL DEFAULT 'MANUAL',
    `reservedUntil` DATETIME(3) NOT NULL,
    `assignedToId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Order_orderNumber_key`(`orderNumber`),
    UNIQUE INDEX `Order_idempotencyKey_key`(`idempotencyKey`),
    INDEX `Order_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `Order_productId_createdAt_idx`(`productId`, `createdAt`),
    INDEX `Order_assignedToId_status_idx`(`assignedToId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderStatusHistory` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `fromStatus` ENUM('MANUAL_PENDING', 'CONTACTED', 'AWAITING_PAYMENT', 'PAYMENT_PROCESSING', 'PAID', 'FULFILLING', 'COMPLETED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED', 'DISPUTED') NULL,
    `toStatus` ENUM('MANUAL_PENDING', 'CONTACTED', 'AWAITING_PAYMENT', 'PAYMENT_PROCESSING', 'PAID', 'FULFILLING', 'COMPLETED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED', 'DISPUTED') NOT NULL,
    `reason` VARCHAR(500) NULL,
    `actorId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OrderStatusHistory_orderId_createdAt_idx`(`orderId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdminUser` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(254) NOT NULL,
    `displayName` VARCHAR(120) NOT NULL,
    `status` ENUM('INVITED', 'ACTIVE', 'LOCKED', 'DISABLED') NOT NULL DEFAULT 'INVITED',
    `totpSecretEncrypted` TEXT NULL,
    `totpEnabled` BOOLEAN NOT NULL DEFAULT false,
    `failedLoginCount` INTEGER NOT NULL DEFAULT 0,
    `lockedUntil` DATETIME(3) NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AdminUser_email_key`(`email`),
    INDEX `AdminUser_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WebAuthnCredential` (
    `id` VARCHAR(191) NOT NULL,
    `adminUserId` VARCHAR(191) NOT NULL,
    `credentialId` TEXT NOT NULL,
    `credentialIdHash` CHAR(64) NOT NULL,
    `publicKey` LONGBLOB NOT NULL,
    `counter` BIGINT NOT NULL DEFAULT 0,
    `transports` JSON NULL,
    `deviceType` VARCHAR(80) NULL,
    `backedUp` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastUsedAt` DATETIME(3) NULL,

    UNIQUE INDEX `WebAuthnCredential_credentialIdHash_key`(`credentialIdHash`),
    INDEX `WebAuthnCredential_adminUserId_idx`(`adminUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RecoveryCode` (
    `id` VARCHAR(191) NOT NULL,
    `adminUserId` VARCHAR(191) NOT NULL,
    `codeHash` CHAR(64) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `RecoveryCode_codeHash_key`(`codeHash`),
    INDEX `RecoveryCode_adminUserId_usedAt_idx`(`adminUserId`, `usedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Role` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(80) NOT NULL,
    `nameZh` VARCHAR(120) NOT NULL,
    `nameEn` VARCHAR(120) NOT NULL,
    `description` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Role_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Permission` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(120) NOT NULL,
    `description` VARCHAR(500) NULL,

    UNIQUE INDEX `Permission_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdminUserRole` (
    `adminUserId` VARCHAR(191) NOT NULL,
    `roleId` VARCHAR(191) NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`adminUserId`, `roleId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RolePermission` (
    `roleId` VARCHAR(191) NOT NULL,
    `permissionId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`roleId`, `permissionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditEvent` (
    `id` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `action` VARCHAR(120) NOT NULL,
    `targetType` VARCHAR(80) NOT NULL,
    `targetId` VARCHAR(160) NULL,
    `result` ENUM('SUCCEEDED', 'FAILED', 'DENIED') NOT NULL,
    `requestId` VARCHAR(80) NOT NULL,
    `reason` VARCHAR(500) NULL,
    `beforeData` JSON NULL,
    `afterData` JSON NULL,
    `ipHash` CHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditEvent_actorId_createdAt_idx`(`actorId`, `createdAt`),
    INDEX `AuditEvent_action_createdAt_idx`(`action`, `createdAt`),
    INDEX `AuditEvent_targetType_targetId_createdAt_idx`(`targetType`, `targetId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SiteSetting` (
    `key` VARCHAR(120) NOT NULL,
    `value` JSON NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CategoryTranslation` ADD CONSTRAINT `CategoryTranslation_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductTranslation` ADD CONSTRAINT `ProductTranslation_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HeroTranslation` ADD CONSTRAINT `HeroTranslation_heroId_fkey` FOREIGN KEY (`heroId`) REFERENCES `Hero`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExchangeRate` ADD CONSTRAINT `ExchangeRate_fromCode_fkey` FOREIGN KEY (`fromCode`) REFERENCES `Currency`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExchangeRate` ADD CONSTRAINT `ExchangeRate_toCode_fkey` FOREIGN KEY (`toCode`) REFERENCES `Currency`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_currencyCode_fkey` FOREIGN KEY (`currencyCode`) REFERENCES `Currency`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderStatusHistory` ADD CONSTRAINT `OrderStatusHistory_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderStatusHistory` ADD CONSTRAINT `OrderStatusHistory_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WebAuthnCredential` ADD CONSTRAINT `WebAuthnCredential_adminUserId_fkey` FOREIGN KEY (`adminUserId`) REFERENCES `AdminUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RecoveryCode` ADD CONSTRAINT `RecoveryCode_adminUserId_fkey` FOREIGN KEY (`adminUserId`) REFERENCES `AdminUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdminUserRole` ADD CONSTRAINT `AdminUserRole_adminUserId_fkey` FOREIGN KEY (`adminUserId`) REFERENCES `AdminUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdminUserRole` ADD CONSTRAINT `AdminUserRole_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RolePermission` ADD CONSTRAINT `RolePermission_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RolePermission` ADD CONSTRAINT `RolePermission_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `Permission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditEvent` ADD CONSTRAINT `AuditEvent_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
