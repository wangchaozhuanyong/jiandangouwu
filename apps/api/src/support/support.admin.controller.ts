import { Body, Controller, Get, Param, Patch, Req } from "@nestjs/common";
import type { Request } from "express";
import { RequirePermissions } from "../auth/auth.decorators.js";
import { adminActorFromRequest } from "../common/admin-actor.js";
import {
  ReorderContactChannelsDto,
  UpdateContactChannelDto,
} from "./support.dto.js";
import { SupportService } from "./support.service.js";

@Controller("admin/contact-channels")
export class SupportAdminController {
  constructor(private readonly support: SupportService) {}

  @Get()
  @RequirePermissions("support.read")
  list() {
    return this.support.channels();
  }

  @Patch("order")
  @RequirePermissions("support.write")
  reorder(@Body() input: ReorderContactChannelsDto, @Req() request: Request) {
    return this.support.reorderChannels(input, adminActorFromRequest(request));
  }

  @Patch(":id")
  @RequirePermissions("support.write")
  update(
    @Param("id") id: string,
    @Body() input: UpdateContactChannelDto,
    @Req() request: Request,
  ) {
    return this.support.updateChannel(id, input, adminActorFromRequest(request));
  }
}
