import {
  adminOrderScopes,
  contactChannelTypes,
  orderStatuses,
  type AdminOrderListQuery,
  type AdminOrderScope,
  type AssignAdminOrderInput,
  type ContactChannelType,
  type OrderStatus,
  type RevealAdminOrderContactInput,
  type UpdateAdminOrderStatusInput,
} from "@cloudbridge/contracts";
import { Transform } from "class-transformer";
import {
  IsDateString,
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

const toNumber = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" && value.trim() !== "" ? Number(value) : value;

export class AdminOrderListQueryDto implements AdminOrderListQuery {
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 30;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  search?: string;

  @Transform(trimString)
  @IsOptional()
  @IsIn([...adminOrderScopes])
  scope?: AdminOrderScope;

  @Transform(trimString)
  @IsOptional()
  @IsIn([...orderStatuses])
  status?: OrderStatus;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @Matches(/^(?:UNASSIGNED|[A-Za-z0-9_-]{1,191})$/u)
  assigneeId?: string | "UNASSIGNED";

  @Transform(trimString)
  @IsOptional()
  @IsIn([...contactChannelTypes])
  contactChannel?: ContactChannelType;
}

export class UpdateAdminOrderStatusDto implements UpdateAdminOrderStatusInput {
  @Transform(trimString)
  @IsIn([...orderStatuses])
  expectedStatus!: OrderStatus;

  @Transform(trimString)
  @IsDateString({ strict: true })
  expectedUpdatedAt!: string;

  @Transform(trimString)
  @IsIn([...orderStatuses])
  status!: OrderStatus;

  @Transform(trimString)
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  reason!: string;
}

export class AssignAdminOrderDto implements AssignAdminOrderInput {
  @IsDefined()
  @Transform(trimString)
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,191}$/u)
  assigneeId!: string | null;

  @IsDefined()
  @Transform(trimString)
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,191}$/u)
  expectedAssigneeId!: string | null;

  @Transform(trimString)
  @IsDateString({ strict: true })
  expectedUpdatedAt!: string;

  @Transform(trimString)
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  reason!: string;
}

export class RevealAdminOrderContactDto implements RevealAdminOrderContactInput {
  @Transform(trimString)
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  reason!: string;
}
