import { Transform } from "class-transformer";
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsISO8601,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import type { AdminMemberLifecycleAction } from "@cloudbridge/contracts";

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

const trimUpper = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim().toUpperCase() : value;

export class CreateRoleDto {
  @Transform(trimUpper)
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]{2,79}$/u)
  key!: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nameZh!: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nameEn!: string;

  @Transform(trim)
  @IsString()
  @MaxLength(500)
  description!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  permissionKeys!: string[];

  @Transform(trim)
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  reason!: string;
}

export class UpdateRoleMetadataDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nameZh!: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nameEn!: string;

  @Transform(trim)
  @IsString()
  @MaxLength(500)
  description!: string;

  @IsISO8601({ strict: true })
  expectedUpdatedAt!: string;

  @Transform(trim)
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  reason!: string;
}

export class DeleteRoleDto {
  @IsISO8601({ strict: true })
  expectedUpdatedAt!: string;

  @Transform(trim)
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  reason!: string;
}

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
