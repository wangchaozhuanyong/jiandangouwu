import type { SystemHealthStatus } from "@cloudbridge/contracts";
import {
  Controller,
  Get,
  ServiceUnavailableException,
} from "@nestjs/common";
import { SessionService } from "../auth/session.service.js";
import { PrismaService } from "../prisma/prisma.service.js";

export const HEALTH_PROBE_TIMEOUT_MS = 1_500;

export async function measureHealthProbe(
  probe: () => Promise<unknown>,
  timeoutMs = HEALTH_PROBE_TIMEOUT_MS,
): Promise<number> {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error("Health probe timeout must be a positive safe integer.");
  }
  const startedAt = performance.now();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.resolve().then(probe),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Health probe timed out.")),
          timeoutMs,
        );
        timeout.unref?.();
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
  return Math.max(0, Math.round(performance.now() - startedAt));
}

@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
  ) {}

  @Get()
  async health(): Promise<SystemHealthStatus> {
    let databaseLatencyMs: number;
    let valkeyLatencyMs: number;
    try {
      [databaseLatencyMs, valkeyLatencyMs] = await Promise.all([
        measureHealthProbe(() => this.prisma.$queryRaw`SELECT 1`),
        measureHealthProbe(() => this.sessions.assertAvailable()),
      ]);
    } catch {
      throw new ServiceUnavailableException(
        "A required health dependency is unavailable.",
      );
    }
    return {
      status: "healthy",
      database: "connected",
      valkey: "connected",
      latencyMs: {
        database: databaseLatencyMs,
        valkey: valkeyLatencyMs,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
