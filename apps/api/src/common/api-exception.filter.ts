import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import { Catch, HttpException, HttpStatus } from "@nestjs/common";
import type { Response } from "express";

type ValidationMessage = string | {
  property?: string;
  constraints?: Record<string, string>;
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Express.Request>();
    const response = context.getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = exception instanceof HttpException ? exception.getResponse() : null;
    const rawCode = typeof payload === "object"
      && payload !== null
      && "code" in payload
      && typeof (payload as { code?: unknown }).code === "string"
      ? (payload as { code: string }).code
      : null;
    const safeCode = rawCode && /^[A-Z][A-Z0-9_]{2,63}$/u.test(rawCode)
      ? rawCode
      : null;
    const rawMessage = typeof payload === "object" && payload !== null && "message" in payload
      ? (payload as { message: ValidationMessage | ValidationMessage[] }).message
      : null;
    const messages = Array.isArray(rawMessage) ? rawMessage : rawMessage ? [rawMessage] : [];
    const details = messages.flatMap((message) => {
      if (typeof message === "string") return [{ code: "VALIDATION_ERROR", message }];
      return Object.entries(message.constraints ?? {}).map(([code, text]) => ({
        field: message.property,
        code,
        message: text,
      }));
    });
    const safeMessage = status >= 500
      ? "The service could not complete the request."
      : typeof rawMessage === "string"
        ? rawMessage
        : "The request could not be processed.";

    response.status(status).json({
      error: {
        code: safeCode ?? (status === HttpStatus.BAD_REQUEST
          ? "BAD_REQUEST"
          : status === HttpStatus.UNAUTHORIZED
            ? "UNAUTHORIZED"
            : status === HttpStatus.FORBIDDEN
              ? "FORBIDDEN"
              : status === HttpStatus.NOT_FOUND
                ? "NOT_FOUND"
              : status === HttpStatus.CONFLICT
                  ? "CONFLICT"
                  : "INTERNAL_ERROR"),
        message: safeMessage,
        ...(details.length > 0 ? { details } : {}),
      },
      requestId: request.requestId,
    });
  }
}
