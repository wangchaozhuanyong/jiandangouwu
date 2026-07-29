import { Module } from "@nestjs/common";
import { TelegramNewOrderSettingsController } from "./telegram-new-order-settings.controller.js";
import { TelegramNewOrderSettingsService } from "./telegram-new-order-settings.service.js";

@Module({
  controllers: [TelegramNewOrderSettingsController],
  providers: [TelegramNewOrderSettingsService],
})
export class NotificationsModule {}
