import { Body, Controller, Get, HttpCode, Post, Req, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { PublicAdmin } from "./auth.decorators.js";
import {
  FirstAdminSetupDto,
  PasswordLoginDto,
  TotpDisableDto,
  TotpLoginDto,
  TotpVerifyDto,
} from "./auth.dto.js";
import { AuthService } from "./auth.service.js";
import { SessionService } from "./session.service.js";

@Controller("admin/auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly config: ConfigService,
  ) {}

  @PublicAdmin()
  @Get("setup/status")
  setupStatus(@Req() request: Request) {
    return this.auth.setupStatus(this.context(request));
  }

  @PublicAdmin()
  @Post("setup")
  async setupFirstAdmin(
    @Body() body: FirstAdminSetupDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const issued = await this.auth.setupFirstAdmin(body, this.context(request));
    this.setSessionCookie(response, issued.token);
    return { csrfToken: issued.record.csrfToken };
  }

  @PublicAdmin()
  @Post("login")
  @HttpCode(200)
  async login(
    @Body() body: PasswordLoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.loginWithPassword(body.email, body.password, this.context(request));
    if (result.requiresTotp) return result;
    this.setSessionCookie(response, result.issued.token);
    return { requiresTotp: false, csrfToken: result.issued.record.csrfToken };
  }

  @PublicAdmin()
  @Post("login/totp")
  @HttpCode(200)
  async loginTotp(
    @Body() body: TotpLoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const issued = await this.auth.loginWithTotp(body.flowId, body.token, this.context(request));
    this.setSessionCookie(response, issued.token);
    return { csrfToken: issued.record.csrfToken };
  }

  @Get("me")
  async me(@Req() request: Request) {
    const user = await this.auth.sessionProfile(request.adminSession!.userId);
    const token = request.cookies?.[this.cookieName] as string | undefined;
    if (token) await this.sessions.synchronizePermissions(token, user.permissions);
    return {
      user,
      csrfToken: request.adminSession!.csrfToken,
    };
  }

  @Post("totp/enrollment")
  beginTotp(@Req() request: Request) {
    return this.auth.beginTotpEnrollment(request.adminSession!.userId);
  }

  @Post("totp/verify")
  verifyTotp(@Body() body: TotpVerifyDto, @Req() request: Request) {
    return this.auth.verifyTotpEnrollment(
      request.adminSession!.userId,
      body.flowId,
      body.token,
      this.context(request),
    );
  }

  @Post("totp/disable")
  disableTotp(@Body() body: TotpDisableDto, @Req() request: Request) {
    return this.auth.disableTotp(
      request.adminSession!.userId,
      body.password,
      this.context(request),
    );
  }

  @Post("logout")
  @HttpCode(204)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
    const cookieName = this.cookieName;
    const token = request.cookies?.[cookieName] as string | undefined;
    if (token) await this.sessions.destroy(token);
    response.clearCookie(cookieName, this.cookieOptions);
  }

  private context(request: Request) {
    return { requestId: request.requestId, ip: request.ip };
  }

  private setSessionCookie(response: Response, token: string): void {
    response.cookie(this.cookieName, token, {
      ...this.cookieOptions,
      maxAge: 8 * 60 * 60 * 1000,
    });
  }

  private get cookieName(): string {
    return this.config.get<string>("SESSION_COOKIE_NAME") ?? "cloudbridge_admin_session";
  }

  private get cookieOptions() {
    return {
      httpOnly: true,
      sameSite: "strict" as const,
      secure: this.config.get<string>("NODE_ENV") === "production",
      path: "/v1/admin",
    };
  }
}
