import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

class LocalizedChannelTextDto {
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

export class UpdateContactChannelDto {
  @IsInt()
  @Min(1)
  version!: number;

  @IsDefined()
  @ValidateNested()
  @Type(() => LocalizedChannelTextDto)
  label!: LocalizedChannelTextDto;

  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(240)
  publicAccount!: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(512)
  directTarget!: string | null;

  @IsDefined()
  @ValidateNested()
  @Type(() => LocalizedChannelTextDto)
  serviceHours!: LocalizedChannelTextDto;

  @IsBoolean()
  active!: boolean;

  @IsInt()
  @Min(0)
  @Max(9999)
  sortOrder!: number;
}

class ReorderContactChannelItemDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  id!: string;

  @IsInt()
  @Min(1)
  version!: number;
}

export class ReorderContactChannelsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ReorderContactChannelItemDto)
  items!: ReorderContactChannelItemDto[];
}
