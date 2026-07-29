import type { Request } from "express";

export type AdminActor = {
  userId: string;
  requestId: string;
  ip?: string;
  reauthenticatedAt?: number | null;
};

export const adminActorFromRequest = (request: Request): AdminActor => ({
  userId: request.adminSession!.userId,
  requestId: request.requestId,
  ip: request.ip,
  reauthenticatedAt: request.adminSession!.reauthenticatedAt,
});
