import { Transform } from "class-transformer";
import { IsEmail, IsString, Length, Matches, MaxLength, MinLength } from "class-validator";

const normalizeEmail = ({ value }: { value: unknown }): unknown => typeof value === "string"
  ? value.trim().toLocaleLowerCase()
  : value;

const strongPassword = /^(?=.*[A-Za-z])(?=.*\d).{12,128}$/u;

export class FirstAdminSetupDto {
  @IsEmail()
  @Transform(normalizeEmail)
  email!: string;

  @IsString()
  @Length(2, 120)
  displayName!: string;

  @IsString()
  @Matches(strongPassword, {
    message: "password must be 12-128 characters and include a letter and a number",
  })
  password!: string;
}

export class PasswordLoginDto {
  @IsEmail()
  @Transform(normalizeEmail)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}

export class TotpLoginDto {
  @IsString()
  @Length(20, 120)
  flowId!: string;

  @IsString()
  @Matches(/^\d{6}$/u)
  token!: string;
}

export class TotpVerifyDto extends TotpLoginDto {}

export class TotpDisableDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}
