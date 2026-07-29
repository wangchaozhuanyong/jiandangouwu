import { Module } from "@nestjs/common";
import { ManualPaymentEventsController } from "./manual-payment-events.controller.js";
import { ManualPaymentEventsService } from "./manual-payment-events.service.js";

@Module({
  controllers: [ManualPaymentEventsController],
  providers: [ManualPaymentEventsService],
})
export class FinanceModule {}
