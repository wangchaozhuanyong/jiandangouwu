import { Module } from "@nestjs/common";
import { ContactProtectionService } from "./contact-protection.service.js";
import { OrdersController } from "./orders.controller.js";
import { OrdersService } from "./orders.service.js";

@Module({
  controllers: [OrdersController],
  providers: [ContactProtectionService, OrdersService],
  exports: [ContactProtectionService],
})
export class OrdersModule {}
