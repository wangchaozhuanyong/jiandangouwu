import { Body, Controller, Get, Header, Param, Patch, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import { RequirePermissions } from "../auth/auth.decorators.js";
import { adminActorFromRequest } from "../common/admin-actor.js";
import {
  AdminAuditQueryDto,
  AdminListQueryDto,
  CreateCategoryDto,
  CreateProductDto,
  UpdateCategoryDto,
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
    return this.admin.createCategory(input, adminActorFromRequest(request));
  }

  @Patch("categories/:id")
  @RequirePermissions("catalog.write")
  updateCategory(@Param("id") id: string, @Body() input: UpdateCategoryDto, @Req() request: Request) {
    return this.admin.updateCategory(id, input, adminActorFromRequest(request));
  }

  @Get("products")
  @RequirePermissions("catalog.read")
  products(@Query() query: AdminListQueryDto) {
    return this.admin.products(query);
  }

  @Post("products")
  @RequirePermissions("catalog.write")
  createProduct(@Body() input: CreateProductDto, @Req() request: Request) {
    return this.admin.createProduct(input, adminActorFromRequest(request));
  }

  @Patch("products/:id")
  @RequirePermissions("catalog.write")
  updateProduct(@Param("id") id: string, @Body() input: UpdateProductDto, @Req() request: Request) {
    return this.admin.updateProduct(id, input, adminActorFromRequest(request));
  }

  @Get("currencies")
  @RequirePermissions("catalog.read")
  currencies() {
    return this.admin.currencies();
  }

  @Patch("currencies/:code/rate")
  @RequirePermissions("currencies.write")
  updateRate(@Param("code") code: string, @Body() input: UpdateRateDto, @Req() request: Request) {
    return this.admin.updateRate(code.toUpperCase(), input, adminActorFromRequest(request));
  }

  @Get("audit")
  @RequirePermissions("audit.read")
  @Header("Cache-Control", "private, no-store")
  audit(@Query() query: AdminAuditQueryDto) {
    return this.admin.auditEvents(query);
  }
}
