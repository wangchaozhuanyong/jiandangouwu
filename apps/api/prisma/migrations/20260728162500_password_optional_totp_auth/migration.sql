ALTER TABLE `AdminUser`
  ADD COLUMN `passwordHash` TEXT NULL AFTER `displayName`;

DROP TABLE `RecoveryCode`;
DROP TABLE `WebAuthnCredential`;

DELETE FROM `SiteSetting`
WHERE `key` = 'auth.bootstrapCompleted';
