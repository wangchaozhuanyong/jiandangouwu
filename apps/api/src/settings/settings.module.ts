import { Module } from "@nestjs/common";
import { SettingsAdminController } from "./settings.admin.controller.js";
import { SettingsService } from "./settings.service.js";

@Module({
  controllers: [SettingsAdminController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
