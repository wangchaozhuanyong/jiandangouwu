import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export function requestIdMiddleware(request: Request, response: Response, next: NextFunction): void {
  const incoming = request.header("x-request-id");
  const requestId = incoming && /^[A-Za-z0-9._:-]{8,80}$/u.test(incoming) ? incoming : randomUUID();
  request.requestId = requestId;
  response.setHeader("x-request-id", requestId);
  next();
}
