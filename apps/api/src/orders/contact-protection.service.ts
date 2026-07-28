import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

const maskContact = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.includes("@")) {
    const [name = "", domain = ""] = trimmed.split("@");
    return `${name.slice(0, 2)}${"*".repeat(Math.max(3, name.length - 2))}@${domain}`;
  }
  if (trimmed.length <= 6) return `${trimmed.slice(0, 1)}***${trimmed.slice(-1)}`;
  return `${trimmed.slice(0, 3)}${"*".repeat(Math.min(8, trimmed.length - 5))}${trimmed.slice(-2)}`;
};

@Injectable()
export class ContactProtectionService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const configured = config.get<string>("AUTH_ENCRYPTION_KEY");
    if (!configured) throw new Error("AUTH_ENCRYPTION_KEY is required");
    const decoded = Buffer.from(configured, "base64");
    this.key = decoded.length === 32
      ? decoded
      : createHash("sha256").update(configured).digest();
  }

  protect(value: string): { encrypted: string; hash: string; masked: string } {
    const normalized = value.normalize("NFKC").trim();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const encrypted = Buffer.concat([cipher.update(normalized, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      encrypted: [iv, tag, encrypted].map((part) => part.toString("base64url")).join("."),
      hash: createHash("sha256").update(normalized.toLocaleLowerCase()).digest("hex"),
      masked: maskContact(normalized),
    };
  }

  reveal(value: string): string {
    const [iv, tag, encrypted] = value.split(".");
    if (!iv || !tag || !encrypted) throw new Error("Encrypted contact is invalid.");
    const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  }
}
