import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service.js";

type AuditInput = {
  actorId?: string;
  action: string;
  targetType: string;
  targetId?: string;
  result: "SUCCEEDED" | "FAILED" | "DENIED";
  requestId: string;
  reason?: string;
  beforeData?: unknown;
  afterData?: unknown;
  ip?: string;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditInput): Promise<void> {
    const toJson = (value: unknown): never | undefined => value === undefined
      ? undefined
      : JSON.parse(JSON.stringify(value, (_, current) =>
          typeof current === "bigint" ? current.toString() : current)) as never;
    await this.prisma.auditEvent.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        result: input.result,
        requestId: input.requestId,
        reason: input.reason,
        beforeData: toJson(input.beforeData),
        afterData: toJson(input.afterData),
        ipHash: input.ip ? createHash("sha256").update(input.ip).digest("hex") : undefined,
      },
    });
  }
}
