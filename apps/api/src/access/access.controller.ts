import { Body, Controller, Get, Param, Patch, Req } from "@nestjs/common";
import type { Request } from "express";
import { RequirePermissions } from "../auth/auth.decorators.js";
import { adminActorFromRequest } from "../common/admin-actor.js";
import {
  UpdateMemberLifecycleDto,
  UpdateMemberRolesDto,
  UpdateRolePermissionsDto,
} from "./access.dto.js";
import { AccessService } from "./access.service.js";

@Controller("admin/access")
export class AccessController {
  constructor(private readonly access: AccessService) {}

  @Get("members")
  @RequirePermissions("team.manage")
  members() {
    return this.access.members();
  }

  @Patch("members/:id/roles")
  @RequirePermissions("team.manage")
  updateMemberRoles(
    @Param("id") id: string,
    @Body() input: UpdateMemberRolesDto,
    @Req() request: Request,
  ) {
    return this.access.updateMemberRoles(id, input, adminActorFromRequest(request));
  }

  @Patch("members/:id/lifecycle")
  @RequirePermissions("team.manage")
  updateMemberLifecycle(
    @Param("id") id: string,
    @Body() input: UpdateMemberLifecycleDto,
    @Req() request: Request,
  ) {
    return this.access.updateMemberLifecycle(id, input, adminActorFromRequest(request));
  }

  @Get("roles")
  @RequirePermissions("roles.manage")
  roles() {
    return this.access.roles();
  }

  @Patch("roles/:id/permissions")
  @RequirePermissions("roles.manage")
  updateRolePermissions(
    @Param("id") id: string,
    @Body() input: UpdateRolePermissionsDto,
    @Req() request: Request,
  ) {
    return this.access.updateRolePermissions(id, input, adminActorFromRequest(request));
  }
}
