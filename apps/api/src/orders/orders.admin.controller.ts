import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { RequirePermissions } from "../auth/auth.decorators.js";
import { adminActorFromRequest } from "../common/admin-actor.js";
import {
  AdminOrderListQueryDto,
  AssignAdminOrderDto,
  RevealAdminOrderContactDto,
  UpdateAdminOrderStatusDto,
} from "./orders.admin.dto.js";
import { OrdersAdminService } from "./orders.admin.service.js";

@Controller("admin/orders")
export class OrdersAdminController {
  constructor(private readonly orders: OrdersAdminService) {}

  @Get()
  @RequirePermissions("orders.read")
  list(@Query() query: AdminOrderListQueryDto) {
    return this.orders.list(query);
  }

  @Get("assignees")
  @RequirePermissions("orders.read")
  assignees() {
    return this.orders.assignees();
  }

  @Get(":id")
  @RequirePermissions("orders.read")
  detail(@Param("id") id: string) {
    return this.orders.detail(id);
  }

  @Patch(":id/status")
  @RequirePermissions("orders.write")
  updateStatus(
    @Param("id") id: string,
    @Body() input: UpdateAdminOrderStatusDto,
    @Req() request: Request,
  ) {
    return this.orders.updateStatus(id, input, adminActorFromRequest(request));
  }

  @Patch(":id/assignment")
  @RequirePermissions("orders.write")
  updateAssignment(
    @Param("id") id: string,
    @Body() input: AssignAdminOrderDto,
    @Req() request: Request,
  ) {
    return this.orders.updateAssignment(id, input, adminActorFromRequest(request));
  }

  @Post(":id/reveal-contact")
  @Header("Cache-Control", "no-store")
  @RequirePermissions("contacts.reveal")
  revealContact(
    @Param("id") id: string,
    @Body() input: RevealAdminOrderContactDto,
    @Req() request: Request,
  ) {
    return this.orders.revealContact(id, input, adminActorFromRequest(request));
  }
}
