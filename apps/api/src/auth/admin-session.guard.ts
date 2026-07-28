import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import { PERMISSIONS_KEY, PUBLIC_ADMIN_KEY } from "./auth.decorators.js";
import { SessionService } from "./session.service.js";

@Injectable()
export class AdminSessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    if (!request.path.startsWith("/v1/admin")) return true;
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_ADMIN_KEY, [context.getHandler(), context.getClass()])) {
      return true;
    }

    const cookieName = this.config.get<string>("SESSION_COOKIE_NAME") ?? "cloudbridge_admin_session";
    const token = request.cookies?.[cookieName] as string | undefined;
    const session = token ? await this.sessions.get(token) : null;
    if (!session) throw new UnauthorizedException("Admin session is required.");

    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      const csrf = request.header("x-csrf-token") ?? "";
      const expected = session.csrfToken;
      if (
        csrf.length !== expected.length
        || !timingSafeEqual(Buffer.from(csrf), Buffer.from(expected))
      ) {
        throw new ForbiddenException("CSRF token is invalid.");
      }
      const allowedOrigins = [
        this.config.get<string>("ADMIN_ORIGIN"),
      ].filter((value): value is string => Boolean(value));
      const origin = request.header("origin");
      if (origin && !allowedOrigins.includes(origin)) throw new ForbiddenException("Origin is not allowed.");
    }

    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) ?? [];
    const permissions = new Set(session.permissions);
    if (required.some((permission) => !permissions.has(permission))) {
      throw new ForbiddenException("Permission is required.");
    }
    request.adminSession = {
      ...session,
      permissions,
    };
    return true;
  }
}
