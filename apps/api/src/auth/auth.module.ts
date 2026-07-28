import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AdminSessionGuard } from "./admin-session.guard.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { SessionService } from "./session.service.js";

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionService,
    {
      provide: APP_GUARD,
      useClass: AdminSessionGuard,
    },
  ],
  exports: [SessionService],
})
export class AuthModule {}
