import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
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
  ValidateNested,
} from "class-validator";

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

class HeroTranslationDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  eyebrow!: string;

  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title!: string;

  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;

  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  cta!: string;
}

class HeroTranslationsDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => HeroTranslationDto)
  zh!: HeroTranslationDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => HeroTranslationDto)
  en!: HeroTranslationDto;
}

export class CreateHeroDto {
  @Transform(trimString)
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u)
  @MaxLength(80)
  key!: string;

  @Transform(trimString)
  @IsString()
  @Matches(/^\/assets\/[A-Za-z0-9._/-]+$/u)
  @MaxLength(512)
  imageKey!: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u)
  @MaxLength(160)
  targetSlug!: string | null;

  @Transform(trimString)
  @IsIn(["cyan", "blue", "violet", "green"])
  tone!: "cyan" | "blue" | "violet" | "green";

  @Transform(trimString)
  @IsIn(["DRAFT", "ACTIVE", "INACTIVE"])
  status!: "DRAFT" | "ACTIVE" | "INACTIVE";

  @IsInt()
  @Min(0)
  @Max(9999)
  sortOrder!: number;

  @IsDefined()
  @ValidateNested()
  @Type(() => HeroTranslationsDto)
  translations!: HeroTranslationsDto;
}

export class UpdateHeroDto extends CreateHeroDto {
  @IsInt()
  @Min(1)
  version!: number;
}

class ReorderHeroItemDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  id!: string;

  @IsInt()
  @Min(1)
  version!: number;
}

export class ReorderHeroesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ReorderHeroItemDto)
  items!: ReorderHeroItemDto[];
}
