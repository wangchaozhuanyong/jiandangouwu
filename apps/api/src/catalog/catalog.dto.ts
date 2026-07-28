import { Transform } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from "class-validator";

export class CatalogQueryDto {
  @IsIn(["zh", "en"])
  locale: "zh" | "en" = "zh";

  @IsOptional()
  @IsString()
  @Length(1, 80)
  currency = "MYR";

  @IsOptional()
  @IsString()
  @Length(1, 120)
  category?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  search?: string;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page = 1;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(48)
  pageSize = 12;
}

export class LocaleQueryDto {
  @IsIn(["zh", "en"])
  locale: "zh" | "en" = "zh";

  @IsOptional()
  @IsString()
  @Length(1, 80)
  currency = "MYR";
}
