import { Body, Controller, Get, Param, Patch, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { RequirePermissions } from "../auth/auth.decorators.js";
import { adminActorFromRequest } from "../common/admin-actor.js";
import {
  CreateHeroDto,
  ReorderHeroesDto,
  UpdateHeroDto,
} from "./content.dto.js";
import { ContentService } from "./content.service.js";

@Controller("admin/heroes")
export class ContentAdminController {
  constructor(private readonly content: ContentService) {}

  @Get()
  @RequirePermissions("content.read")
  list() {
    return this.content.heroes();
  }

  @Post()
  @RequirePermissions("content.write")
  create(@Body() input: CreateHeroDto, @Req() request: Request) {
    return this.content.createHero(input, adminActorFromRequest(request));
  }

  @Patch("order")
  @RequirePermissions("content.write")
  reorder(@Body() input: ReorderHeroesDto, @Req() request: Request) {
    return this.content.reorderHeroes(input, adminActorFromRequest(request));
  }

  @Patch(":id")
  @RequirePermissions("content.write")
  update(
    @Param("id") id: string,
    @Body() input: UpdateHeroDto,
    @Req() request: Request,
  ) {
    return this.content.updateHero(id, input, adminActorFromRequest(request));
  }
}
