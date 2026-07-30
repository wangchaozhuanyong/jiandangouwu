import { Transform } from "class-transformer";
import {
  Equals,
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

const toNumber = ({ value }: { value: unknown }): unknown => typeof value === "string" ? Number(value) : value;
const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.normalize("NFKC").trim() : value;

export class AdminListQueryDto {
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

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  search?: string;

  @IsOptional()
  @IsIn(["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"])
  status?: "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED";
}

export class AdminAuditQueryDto {
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

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  search?: string;

  @IsOptional()
  @IsIn(["SUCCEEDED", "FAILED", "DENIED"])
  result?: "SUCCEEDED" | "FAILED" | "DENIED";

  @IsOptional()
  @IsIn(["administrator", "system"])
  actor?: "administrator" | "system";

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  targetType?: string;

  @IsOptional()
  @IsIn(["24h", "7d", "30d", "all"])
  timeRange?: "24h" | "7d" | "30d" | "all";
}

export class AdminAuditExportDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  search?: string;

  @IsOptional()
  @IsIn(["SUCCEEDED", "FAILED", "DENIED"])
  result?: "SUCCEEDED" | "FAILED" | "DENIED";

  @IsOptional()
  @IsIn(["administrator", "system"])
  actor?: "administrator" | "system";

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  targetType?: string;

  @IsOptional()
  @IsIn(["24h", "7d", "30d", "all"])
  timeRange?: "24h" | "7d" | "30d" | "all";

  @Transform(trimString)
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  reason!: string;

  @Equals("EXPORT_AUDIT_CSV")
  confirmation!: "EXPORT_AUDIT_CSV";
}

export class CreateCategoryDto {
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u)
  @MaxLength(120)
  slug!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  nameZh!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  nameEn!: string;

  @IsInt()
  @Min(0)
  @Max(9999)
  sortOrder!: number;

  @IsIn(["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"])
  status: "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED" = "ACTIVE";
}

export class UpdateCategoryDto {
  @IsInt()
  @Min(1)
  version!: number;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u)
  @MaxLength(120)
  slug?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  nameZh?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  nameEn?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  sortOrder?: number;

  @IsOptional()
  @IsIn(["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"])
  status?: "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED";
}

export class CreateProductDto {
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u)
  @MaxLength(160)
  slug!: string;

  @IsString()
  categoryId!: string;

  @IsString()
  @Matches(/^\/assets\/[A-Za-z0-9._/-]+$/u)
  @MaxLength(512)
  imageKey!: string;

  @IsString()
  @Matches(/^\d{1,16}(?:\.\d{1,2})?$/u)
  basePrice!: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Matches(/^\d{1,16}(?:\.\d{1,2})?$/u)
  compareAtPrice?: string | null;

  @IsIn(["FINITE", "UNLIMITED"])
  stockMode!: "FINITE" | "UNLIMITED";

  @IsOptional()
  @IsInt()
  @Min(0)
  stockQuantity?: number | null;

  @IsIn(["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"])
  status!: "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED";

  @IsInt()
  @Min(0)
  @Max(9999)
  sortOrder!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  nameZh!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  nameEn!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(180)
  kickerZh!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(180)
  kickerEn!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  descriptionZh!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  descriptionEn!: string;
}

export class UpdateProductDto extends CreateProductDto {
  @IsInt()
  @Min(1)
  version!: number;
}

export class UpdateRateDto {
  @IsString()
  @Matches(/^\d{1,16}(?:\.\d{1,10})?$/u)
  rate!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(500)
  reason!: string;
}
