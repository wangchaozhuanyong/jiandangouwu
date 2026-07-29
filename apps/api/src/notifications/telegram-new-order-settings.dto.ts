import {
  telegramNewOrderFieldCodes,
  type TelegramNewOrderFieldCode,
  type UpdateAdminTelegramNewOrderSettingsInput,
} from "@cloudbridge/contracts";
import { Transform } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateBy,
} from "class-validator";
import {
  isSafeTelegramRecipientGroupLabel,
  isSafeTelegramSettingsReason,
} from "./telegram-new-order-settings.model.js";

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

const trimStringArray = ({ value }: { value: unknown }): unknown =>
  Array.isArray(value)
    ? value.map((item) => typeof item === "string" ? item.trim() : item)
    : value;

const IsSafeTelegramRecipientGroupLabel = () => ValidateBy({
  name: "isSafeTelegramRecipientGroupLabel",
  validator: {
    validate: isSafeTelegramRecipientGroupLabel,
    defaultMessage: () => (
      "recipientGroupLabel contains unsupported or sensitive content"
    ),
  },
});

const IsSafeTelegramSettingsReason = () => ValidateBy({
  name: "isSafeTelegramSettingsReason",
  validator: {
    validate: isSafeTelegramSettingsReason,
    defaultMessage: () => "reason contains sensitive or control content",
  },
});

export class UpdateAdminTelegramNewOrderSettingsDto
implements UpdateAdminTelegramNewOrderSettingsInput {
  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  version!: number;

  @IsBoolean()
  requestedEnabled!: boolean;

  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @IsSafeTelegramRecipientGroupLabel()
  recipientGroupLabel!: string;

  @Transform(trimStringArray)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @ArrayUnique()
  @IsIn([...telegramNewOrderFieldCodes], { each: true })
  includedFields!: TelegramNewOrderFieldCode[];

  @Transform(trimString)
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  @IsSafeTelegramSettingsReason()
  reason!: string;
}
