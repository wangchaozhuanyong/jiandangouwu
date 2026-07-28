import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import { RequirePermissions } from "../auth/auth.decorators.js";
import {
  AdminListQueryDto,
  CreateCategoryDto,
  CreateProductDto,
  UpdateCategoryDto,
  UpdateOrderStatusDto,
  UpdateProductDto,
  UpdateRateDto,
} from "./admin.dto.js";
import { AdminService } from "./admin.service.js";

@Controller("admin")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("overview")
  @RequirePermissions("catalog.read", "orders.read")
  overview() {
    return this.admin.overview();
  }

  @Get("categories")
  @RequirePermissions("catalog.read")
  categories() {
    return this.admin.categories();
  }

  @Post("categories")
  @RequirePermissions("catalog.write")
  createCategory(@Body() input: CreateCategoryDto, @Req() request: Request) {
    return this.admin.createCategory(input, this.actor(request));
  }

  @Patch("categories/:id")
  @RequirePermissions("catalog.write")
  updateCategory(@Param("id") id: string, @Body() input: UpdateCategoryDto, @Req() request: Request) {
    return this.admin.updateCategory(id, input, this.actor(request));
  }

  @Get("products")
  @RequirePermissions("catalog.read")
  products(@Query() query: AdminListQueryDto) {
    return this.admin.products(query);
  }

  @Post("products")
  @RequirePermissions("catalog.write")
  createProduct(@Body() input: CreateProductDto, @Req() request: Request) {
    return this.admin.createProduct(input, this.actor(request));
  }

  @Patch("products/:id")
  @RequirePermissions("catalog.write")
  updateProduct(@Param("id") id: string, @Body() input: UpdateProductDto, @Req() request: Request) {
    return this.admin.updateProduct(id, input, this.actor(request));
  }

  @Get("orders")
  @RequirePermissions("orders.read")
  orders(@Query() query: AdminListQueryDto) {
    return this.admin.orders(query);
  }

  @Patch("orders/:id/status")
  @RequirePermissions("orders.write")
  updateOrderStatus(@Param("id") id: string, @Body() input: UpdateOrderStatusDto, @Req() request: Request) {
    return this.admin.updateOrderStatus(id, input, this.actor(request));
  }

  @Post("orders/:id/reveal-contact")
  @RequirePermissions("contacts.reveal")
  revealContact(@Param("id") id: string, @Req() request: Request) {
    return this.admin.revealContact(id, this.actor(request));
  }

  @Get("currencies")
  @RequirePermissions("catalog.read")
  currencies() {
    return this.admin.currencies();
  }

  @Patch("currencies/:code/rate")
  @RequirePermissions("currencies.write")
  updateRate(@Param("code") code: string, @Body() input: UpdateRateDto, @Req() request: Request) {
    return this.admin.updateRate(code.toUpperCase(), input, this.actor(request));
  }

  @Get("audit")
  @RequirePermissions("audit.read")
  audit(@Query() query: AdminListQueryDto) {
    return this.admin.auditEvents(query);
  }

  private actor(request: Request) {
    return {
      userId: request.adminSession!.userId,
      requestId: request.requestId,
      ip: request.ip,
      reauthenticatedAt: request.adminSession!.reauthenticatedAt,
    };
  }
}
