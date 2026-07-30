import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { RequirePermissions } from "../auth/auth.decorators.js";
import { adminActorFromRequest } from "../common/admin-actor.js";
import {
  CreateRoleDto,
  DeleteRoleDto,
  UpdateMemberLifecycleDto,
  UpdateMemberRolesDto,
  UpdateRoleMetadataDto,
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

  @Post("roles")
  @RequirePermissions("roles.manage")
  createRole(
    @Body() input: CreateRoleDto,
    @Req() request: Request,
  ) {
    return this.access.createRole(input, adminActorFromRequest(request));
  }

  @Patch("roles/:id")
  @RequirePermissions("roles.manage")
  updateRoleMetadata(
    @Param("id") id: string,
    @Body() input: UpdateRoleMetadataDto,
    @Req() request: Request,
  ) {
    return this.access.updateRoleMetadata(id, input, adminActorFromRequest(request));
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

  @Delete("roles/:id")
  @RequirePermissions("roles.manage")
  deleteRole(
    @Param("id") id: string,
    @Body() input: DeleteRoleDto,
    @Req() request: Request,
  ) {
    return this.access.deleteRole(id, input, adminActorFromRequest(request));
  }
}
