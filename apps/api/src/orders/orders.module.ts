import { Module } from "@nestjs/common";
import { ContactProtectionService } from "./contact-protection.service.js";
import { OrderReservationService } from "./order-reservation.service.js";
import { OrdersAdminController } from "./orders.admin.controller.js";
import { OrdersAdminService } from "./orders.admin.service.js";
import { OrdersController } from "./orders.controller.js";
import { OrdersService } from "./orders.service.js";

@Module({
  controllers: [OrdersController, OrdersAdminController],
  providers: [
    ContactProtectionService,
    OrderReservationService,
    OrdersService,
    OrdersAdminService,
  ],
  exports: [OrderReservationService],
})
export class OrdersModule {}
