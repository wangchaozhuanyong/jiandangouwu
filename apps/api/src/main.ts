import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module.js";
import { ApiExceptionFilter } from "./common/api-exception.filter.js";
import { ApiResponseInterceptor } from "./common/api-response.interceptor.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bodyParser: true,
  });
  const config = app.get(ConfigService);
  const origins = [
    config.get<string>("API_PUBLIC_ORIGIN"),
    config.get<string>("ADMIN_ORIGIN"),
  ].filter((origin): origin is string => Boolean(origin));

  app.setGlobalPrefix("v1");
  app.use(helmet({
    contentSecurityPolicy: false,
  }));
  app.use(cookieParser());
  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  });
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }));
  app.useGlobalInterceptors(new ApiResponseInterceptor());
  app.useGlobalFilters(new ApiExceptionFilter());

  const swagger = new DocumentBuilder()
    .setTitle("CloudBridge API")
    .setVersion("1")
    .build();
  SwaggerModule.setup("v1/docs", app, SwaggerModule.createDocument(app, swagger));

  const port = config.get<number>("API_PORT") ?? 3001;
  await app.listen(port, "0.0.0.0");
}

void bootstrap();
