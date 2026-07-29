import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AdminModule } from "./admin/admin.module.js";
import { AuditModule } from "./audit/audit.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { CatalogModule } from "./catalog/catalog.module.js";
import { ContentModule } from "./content/content.module.js";
import { requestIdMiddleware } from "./common/request-id.middleware.js";
import { FinanceModule } from "./finance/finance.module.js";
import { HealthController } from "./health/health.controller.js";
import { NotificationsModule } from "./notifications/notifications.module.js";
import { OrdersModule } from "./orders/orders.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { SecurityModule } from "./security/security.module.js";
import { SettingsModule } from "./settings/settings.module.js";
import { SupportModule } from "./support/support.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
    }),
    PrismaModule,
    SecurityModule,
    AuditModule,
    AuthModule,
    AdminModule,
    ContentModule,
    FinanceModule,
    NotificationsModule,
    SupportModule,
    SettingsModule,
    CatalogModule,
    OrdersModule,
  ],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(requestIdMiddleware).forRoutes({
      path: "{*path}",
      method: RequestMethod.ALL,
    });
  }
}
