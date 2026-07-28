import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client.js";

const createAdapter = (config: ConfigService): PrismaMariaDb => {
  const connectionSecurity = {
    ssl: config.get<string>("DB_TLS") === "true",
    allowPublicKeyRetrieval: config.get<string>("DB_ALLOW_PUBLIC_KEY_RETRIEVAL") === "true",
  };
  const databaseUrl = config.get<string>("DATABASE_URL");
  if (databaseUrl) {
    const url = new URL(databaseUrl);
    return new PrismaMariaDb({
      host: url.hostname,
      port: Number(url.port || "3306"),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//u, ""),
      connectionLimit: 10,
      ...connectionSecurity,
    });
  }
  return new PrismaMariaDb({
    host: config.getOrThrow<string>("DB_HOST"),
    port: Number(config.get<string>("DB_PORT") ?? "3306"),
    user: config.getOrThrow<string>("DB_USER"),
    password: config.getOrThrow<string>("DB_PASSWORD"),
    database: config.getOrThrow<string>("DB_NAME"),
    connectionLimit: 10,
    ...connectionSecurity,
  });
};

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService) {
    super({ adapter: createAdapter(config) });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
