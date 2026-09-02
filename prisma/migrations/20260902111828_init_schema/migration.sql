-- CreateTable
CREATE TABLE `Notification` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `referenceId` INTEGER NULL,
    `eventKey` VARCHAR(191) NOT NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Notification_eventKey_key`(`eventKey`),
    INDEX `Notification_userId_isRead_createdAt_idx`(`userId`, `isRead`, `createdAt`),
    INDEX `Notification_referenceId_idx`(`referenceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PushSubscription` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `endpoint` TEXT NOT NULL,
    `p256dh` VARCHAR(191) NOT NULL,
    `auth` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PushSubscription_userId_idx`(`userId`),
    UNIQUE INDEX `PushSubscription_userId_endpoint_key`(`userId`, `endpoint`(191)),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PushSubscription` ADD CONSTRAINT `PushSubscription_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
