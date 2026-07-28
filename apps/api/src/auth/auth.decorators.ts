import { SetMetadata } from "@nestjs/common";

export const PUBLIC_ADMIN_KEY = "cloudbridge:public-admin";
export const PERMISSIONS_KEY = "cloudbridge:permissions";

export const PublicAdmin = (): MethodDecorator & ClassDecorator => SetMetadata(PUBLIC_ADMIN_KEY, true);
export const RequirePermissions = (...permissions: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMISSIONS_KEY, permissions);
