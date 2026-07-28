import { Global, Module } from "@nestjs/common";
import { SecretProtectionService } from "./secret-protection.service.js";

@Global()
@Module({
  providers: [SecretProtectionService],
  exports: [SecretProtectionService],
})
export class SecurityModule {}
