import { Module } from "@nestjs/common";
import { ContentAdminController } from "./content.admin.controller.js";
import { ContentService } from "./content.service.js";

@Module({
  controllers: [ContentAdminController],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}
