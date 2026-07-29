import { Transform } from "class-transformer";
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsISO8601,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import type { AdminMemberLifecycleAction } from "@cloudbridge/contracts";

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

export class UpdateMemberRolesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  roleIds!: string[];

  @IsISO8601({ strict: true })
  expectedUpdatedAt!: string;

  @Transform(trim)
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  reason!: string;
}

export class UpdateRolePermissionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  permissionKeys!: string[];

  @IsISO8601({ strict: true })
  expectedUpdatedAt!: string;

  @Transform(trim)
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  reason!: string;
}

export class UpdateMemberLifecycleDto {
  @IsIn(["ENABLE", "DISABLE", "UNLOCK", "RESET_TOTP"])
  action!: AdminMemberLifecycleAction;

  @IsISO8601({ strict: true })
  expectedUpdatedAt!: string;

  @Transform(trim)
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  reason!: string;
}
