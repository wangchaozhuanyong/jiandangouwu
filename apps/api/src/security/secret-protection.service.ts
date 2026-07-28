import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

@Injectable()
export class SecretProtectionService {
  constructor(private readonly config: ConfigService) {}

  encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key(), iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return ["v1", iv, tag, encrypted].map((part) => typeof part === "string" ? part : part.toString("base64url")).join(".");
  }

  decrypt(value: string): string {
    const [version, iv, tag, encrypted] = value.split(".");
    if (version !== "v1" || !iv || !tag || !encrypted) {
      throw new InternalServerErrorException("Encrypted secret is invalid.");
    }
    const decipher = createDecipheriv("aes-256-gcm", this.key(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  }

  private key(): Buffer {
    const raw = this.config.get<string>("AUTH_ENCRYPTION_KEY") ?? "";
    if (Buffer.byteLength(raw) < 32) {
      throw new InternalServerErrorException("AUTH_ENCRYPTION_KEY must contain at least 32 bytes.");
    }
    const decoded = Buffer.from(raw, "base64");
    return decoded.byteLength === 32 ? decoded : createHash("sha256").update(raw).digest();
  }
}
