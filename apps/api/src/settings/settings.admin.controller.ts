import { Body, Controller, Get, Patch, Req } from "@nestjs/common";
import type { Request } from "express";
import { RequirePermissions } from "../auth/auth.decorators.js";
import { adminActorFromRequest } from "../common/admin-actor.js";
import { UpdateStorefrontSettingsDto } from "./settings.dto.js";
import { SettingsService } from "./settings.service.js";

@Controller("admin/site-settings")
export class SettingsAdminController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @RequirePermissions("settings.read")
  get() {
    return this.settings.adminSettings();
  }

  @Patch()
  @RequirePermissions("settings.write")
  update(@Body() input: UpdateStorefrontSettingsDto, @Req() request: Request) {
    return this.settings.update(input, adminActorFromRequest(request));
  }
}
