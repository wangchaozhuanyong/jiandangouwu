import {
  manualPaymentEventTypes,
  type AdminManualPaymentEventListQuery,
  type ManualPaymentEventType,
} from "@cloudbridge/contracts";
import { Transform } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

const uppercaseString = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim().toUpperCase() : value;

const toNumber = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" && value.trim() !== "" ? Number(value) : value;

export class AdminManualPaymentEventListQueryDto
implements AdminManualPaymentEventListQuery {
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(1000)
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
  @IsIn([...manualPaymentEventTypes])
  eventType?: ManualPaymentEventType;

  @Transform(uppercaseString)
  @IsOptional()
  @Matches(/^[A-Z]{3,4}$/u)
  currencyCode?: string;

  @Transform(trimString)
  @IsOptional()
  @Matches(/^[A-Za-z0-9_-]{1,191}$/u)
  actorId?: string;

  @Transform(trimString)
  @IsOptional()
  @Matches(/^(?:UNASSIGNED|[A-Za-z0-9_-]{1,191})$/u)
  assigneeId?: string | "UNASSIGNED";
}
