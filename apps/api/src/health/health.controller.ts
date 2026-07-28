import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      status: "healthy",
      database: "connected",
      timestamp: new Date().toISOString(),
    };
  }
}
