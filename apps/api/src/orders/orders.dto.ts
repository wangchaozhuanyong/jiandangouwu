import { IsIn, IsNotEmpty, IsString, Length, Matches, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

class ExpectedPriceDto {
  @IsString()
  @Matches(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,8})?$/u)
  amount!: string;

  @IsString()
  @Matches(/^[A-Z]{3,4}$/u)
  currency!: string;
}

export class CreateOrderDto {
  @IsIn(["zh", "en"])
  locale!: "zh" | "en";

  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsString()
  @Matches(/^[A-Z]{3,4}$/u)
  currency!: string;

  @IsIn(["WHATSAPP", "EMAIL", "TELEGRAM", "WECHAT", "QQ"])
  contactChannel!: "WHATSAPP" | "EMAIL" | "TELEGRAM" | "WECHAT" | "QQ";

  @IsString()
  @Length(4, 254)
  contactValue!: string;

  @IsString()
  @Length(1, 80)
  acceptedPolicyVersion!: string;

  @ValidateNested()
  @Type(() => ExpectedPriceDto)
  expectedPrice!: ExpectedPriceDto;
}
