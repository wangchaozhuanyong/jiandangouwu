import {
  Controller,
  Get,
  Header,
  Query,
} from "@nestjs/common";
import { RequirePermissions } from "../auth/auth.decorators.js";
import { AdminManualPaymentEventListQueryDto } from "./manual-payment-events.dto.js";
import { ManualPaymentEventsService } from "./manual-payment-events.service.js";

@Controller("admin/manual-payment-events")
export class ManualPaymentEventsController {
  constructor(private readonly events: ManualPaymentEventsService) {}

  @Get()
  @Header("Cache-Control", "private, no-store")
  @RequirePermissions("orders.read")
  list(@Query() query: AdminManualPaymentEventListQueryDto) {
    return this.events.list(query);
  }
}
