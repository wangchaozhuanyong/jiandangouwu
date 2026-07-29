import { Module } from "@nestjs/common";
import { SupportAdminController } from "./support.admin.controller.js";
import { SupportService } from "./support.service.js";

@Module({
  controllers: [SupportAdminController],
  providers: [SupportService],
  exports: [SupportService],
})
export class SupportModule {}
