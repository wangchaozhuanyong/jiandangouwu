import { Module } from "@nestjs/common";
import { ContactProtectionService } from "./contact-protection.service.js";
import { OrdersAdminController } from "./orders.admin.controller.js";
import { OrdersAdminService } from "./orders.admin.service.js";
import { OrdersController } from "./orders.controller.js";
import { OrdersService } from "./orders.service.js";

@Module({
  controllers: [OrdersController, OrdersAdminController],
  providers: [ContactProtectionService, OrdersService, OrdersAdminService],
})
export class OrdersModule {}
