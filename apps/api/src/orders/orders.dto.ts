import { Transform, Type } from "class-transformer";
import {
  IsDefined,
  IsIn,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
  ValidateNested,
} from "class-validator";

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

class ExpectedPriceDto {
  @Transform(trimString)
  @IsString()
  @Matches(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,8})?$/u)
  amount!: string;

  @Transform(trimString)
  @IsString()
  @Matches(/^[A-Z]{3,4}$/u)
  currency!: string;
}

export class CreateOrderDto {
  @Transform(trimString)
  @IsIn(["zh", "en"])
  locale!: "zh" | "en";

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @Transform(trimString)
  @IsString()
  @Matches(/^[A-Z]{3,4}$/u)
  currency!: string;

  @Transform(trimString)
  @IsIn(["WHATSAPP", "EMAIL", "TELEGRAM", "WECHAT", "QQ"])
  contactChannel!: "WHATSAPP" | "EMAIL" | "TELEGRAM" | "WECHAT" | "QQ";

  @Transform(trimString)
  @IsString()
  @Length(4, 254)
  contactValue!: string;

  @Transform(trimString)
  @IsString()
  @Length(1, 80)
  acceptedPolicyVersion!: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => ExpectedPriceDto)
  expectedPrice!: ExpectedPriceDto;
}
