import { Transform, Type } from "class-transformer";
import {
  INVENTORY_RISK_THRESHOLD_MAX,
  INVENTORY_RISK_THRESHOLD_MIN,
} from "@cloudbridge/contracts";
import {
  IsBoolean,
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

class LocalizedSiteNameDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  zh!: string;

  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  en!: string;
}

class LocalizedSeoDescriptionDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  zh!: string;

  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  en!: string;
}

export class UpdateStorefrontSettingsDto {
  @IsInt()
  @Min(0)
  version!: number;

  @IsDefined()
  @ValidateNested()
  @Type(() => LocalizedSiteNameDto)
  siteName!: LocalizedSiteNameDto;

  @Transform(trimString)
  @IsIn(["zh", "en"])
  defaultLocale!: "zh" | "en";

  @IsDefined()
  @ValidateNested()
  @Type(() => LocalizedSeoDescriptionDto)
  seoDescription!: LocalizedSeoDescriptionDto;

  @Transform(trimString)
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/u)
  policyVersion!: string;

  @IsBoolean()
  acceptOrders!: boolean;

  @IsBoolean()
  supportEnabled!: boolean;

  @IsInt()
  @Min(INVENTORY_RISK_THRESHOLD_MIN)
  @Max(INVENTORY_RISK_THRESHOLD_MAX)
  inventoryRiskThreshold!: number;

  @IsBoolean()
  transitServiceEnabled!: boolean;

  @Transform(trimString)
  @IsOptional()
  @IsUrl({
    protocols: ["https"],
    require_protocol: true,
    require_valid_protocol: true,
  })
  @MaxLength(500)
  transitServiceUrl!: string | null;

  @Transform(trimString)
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  reason!: string;
}
