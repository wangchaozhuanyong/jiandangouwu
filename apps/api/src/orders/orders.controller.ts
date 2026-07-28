import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateOrderDto } from "./orders.dto.js";
import { OrdersService } from "./orders.service.js";

@ApiTags("orders")
@Controller("orders")
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  create(
    @Body() input: CreateOrderDto,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    if (!idempotencyKey || !/^[A-Za-z0-9._:-]{16,120}$/u.test(idempotencyKey)) {
      throw new BadRequestException("A valid Idempotency-Key header is required.");
    }
    return this.orders.create(input, idempotencyKey);
  }
}
