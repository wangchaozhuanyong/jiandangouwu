import {
  Body,
  Controller,
  Get,
  Header,
  Post,
  Put,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { RequirePermissions } from "../auth/auth.decorators.js";
import { adminActorFromRequest } from "../common/admin-actor.js";
import { UpdateAdminTelegramNewOrderSettingsDto } from "./telegram-new-order-settings.dto.js";
import { TelegramNewOrderSettingsService } from "./telegram-new-order-settings.service.js";

@Controller("admin/telegram-new-order-settings")
export class TelegramNewOrderSettingsController {
  constructor(private readonly settings: TelegramNewOrderSettingsService) {}

  @Get()
  @Header("Cache-Control", "private, no-store")
  @RequirePermissions("settings.read")
  get() {
    return this.settings.get();
  }

  @Put()
  @Header("Cache-Control", "private, no-store")
  @RequirePermissions("settings.write")
  update(
    @Body() input: UpdateAdminTelegramNewOrderSettingsDto,
    @Req() request: Request,
  ) {
    return this.settings.update(input, adminActorFromRequest(request));
  }

  @Post("simulation")
  @Header("Cache-Control", "private, no-store")
  @RequirePermissions("settings.read")
  simulate() {
    return this.settings.simulate();
  }
}
