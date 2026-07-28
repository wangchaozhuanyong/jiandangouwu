ALTER TABLE `MerchantChannel`
  ADD COLUMN `serviceHoursZh` VARCHAR(120) NULL,
  ADD COLUMN `serviceHoursEn` VARCHAR(120) NULL;

UPDATE `MerchantChannel`
SET
  `serviceHoursZh` = `serviceHours`,
  `serviceHoursEn` = CASE
    WHEN `type` = 'EMAIL' THEN 'Replies within 24 hours'
    ELSE `serviceHours`
  END;

ALTER TABLE `MerchantChannel`
  MODIFY `serviceHoursZh` VARCHAR(120) NOT NULL,
  MODIFY `serviceHoursEn` VARCHAR(120) NOT NULL,
  DROP COLUMN `serviceHours`;
