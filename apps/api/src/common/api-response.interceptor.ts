import type { CallHandler, ExecutionContext, NestInterceptor } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import type { Observable } from "rxjs";
import { map } from "rxjs";

type EnvelopedResult = {
  data: unknown;
  meta?: unknown;
};

const isEnvelopedResult = (value: unknown): value is EnvelopedResult => (
  typeof value === "object"
  && value !== null
  && Object.hasOwn(value, "data")
);

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Express.Request>();
    return next.handle().pipe(map((value: unknown) => (
      isEnvelopedResult(value)
        ? { ...value, requestId: request.requestId }
        : { data: value, requestId: request.requestId }
    )));
  }
}
