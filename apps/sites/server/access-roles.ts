import type {
  AdminRoleKey,
  AssignableAdminRoleKey,
  LocalizedText,
} from "@cloudbridge/contracts";

export const adminPermissions = [
  "catalog.read",
  "catalog.write",
  "orders.read",
  "orders.write",
  "contacts.reveal",
  "currencies.write",
  "team.manage",
  "roles.manage",
  "audit.read",
  "content.read",
  "content.write",
  "support.read",
  "support.write",
  "settings.read",
  "settings.write",
] as const;

type RoleDefinition = {
  key: AdminRoleKey;
  name: LocalizedText;
  description: LocalizedText;
  permissions: readonly string[];
  capabilities: LocalizedText[];
  restrictions: LocalizedText[];
  assignable: boolean;
  systemProtected: boolean;
};

const role = (
  definition: RoleDefinition,
): RoleDefinition => definition;

export const adminRoleDefinitions = [
  role({
    key: "SUPER_ADMIN",
    name: { zh: "所有者", en: "Owner" },
    description: {
      zh: "负责 CloudBridge 的全部业务、权限与关键设置。",
      en: "Owns all CloudBridge operations, access, and critical settings.",
    },
    permissions: adminPermissions,
    capabilities: [
      { zh: "管理所有业务数据和网站设置", en: "Manage all business data and site settings" },
      { zh: "添加、调整和停用员工", en: "Add, change, and disable staff access" },
      { zh: "查看审计、安全和敏感联系方式", en: "Review audit, security, and sensitive contact data" },
    ],
    restrictions: [
      { zh: "系统保护，不能转让、降级或停用", en: "System protected; cannot be transferred, downgraded, or disabled" },
    ],
    assignable: false,
    systemProtected: true,
  }),
  role({
    key: "OPERATIONS",
    name: { zh: "运营员工", en: "Operations staff" },
    description: {
      zh: "负责商品、内容、订单、币种与客服渠道的日常运营。",
      en: "Runs day-to-day catalog, content, orders, currencies, and support channels.",
    },
    permissions: [
      "catalog.read",
      "catalog.write",
      "orders.read",
      "orders.write",
      "contacts.reveal",
      "currencies.write",
      "content.read",
      "content.write",
      "support.read",
      "support.write",
      "settings.read",
    ],
    capabilities: [
      { zh: "维护商品、内容、币种和联系方式", en: "Maintain catalog, content, currencies, and contact channels" },
      { zh: "处理订单并按需查看客户联系方式", en: "Process orders and reveal customer contact details when needed" },
      { zh: "查看网站当前设置", en: "View current site settings" },
    ],
    restrictions: [
      { zh: "不能管理员工、角色和关键网站设置", en: "Cannot manage staff, roles, or critical site settings" },
      { zh: "不能查看审计与安全日志", en: "Cannot access audit and security logs" },
    ],
    assignable: true,
    systemProtected: true,
  }),
  role({
    key: "CUSTOMER_SUPPORT",
    name: { zh: "客服员工", en: "Customer support" },
    description: {
      zh: "负责客户咨询、订单跟进和售后处理。",
      en: "Handles customer enquiries, order follow-up, and after-sales work.",
    },
    permissions: [
      "catalog.read",
      "orders.read",
      "orders.write",
      "contacts.reveal",
      "support.read",
      "settings.read",
    ],
    capabilities: [
      { zh: "查看商品和网站服务状态", en: "View products and storefront service status" },
      { zh: "处理订单、售后与客户联系方式", en: "Handle orders, after-sales cases, and customer contact details" },
    ],
    restrictions: [
      { zh: "不能修改商品、币种、内容或客服渠道", en: "Cannot change catalog, currencies, content, or support channels" },
      { zh: "不能管理员工和安全设置", en: "Cannot manage staff or security settings" },
    ],
    assignable: true,
    systemProtected: true,
  }),
  role({
    key: "READ_ONLY",
    name: { zh: "只读员工", en: "Read-only staff" },
    description: {
      zh: "查看运营状态，不执行写入或敏感数据操作。",
      en: "Reviews operational status without writes or sensitive-data access.",
    },
    permissions: [
      "catalog.read",
      "orders.read",
      "content.read",
      "support.read",
      "settings.read",
    ],
    capabilities: [
      { zh: "查看商品、订单、内容和网站设置", en: "View catalog, orders, content, and site settings" },
    ],
    restrictions: [
      { zh: "不能修改数据或查看完整客户联系方式", en: "Cannot change data or reveal full customer contact details" },
      { zh: "不能管理员工、审计和安全设置", en: "Cannot manage staff, audit, or security settings" },
    ],
    assignable: true,
    systemProtected: true,
  }),
] as const satisfies readonly RoleDefinition[];

export const assignableAdminRoleKeys = adminRoleDefinitions
  .filter((item) => item.assignable)
  .map((item) => item.key) as AssignableAdminRoleKey[];

export function adminRoleDefinition(key: string): RoleDefinition | null {
  return adminRoleDefinitions.find((item) => item.key === key) ?? null;
}

export function adminRoleForPermissions(permissions: readonly string[]): RoleDefinition {
  const normalized = [...new Set(permissions)].sort();
  return adminRoleDefinitions.find((item) => (
    [...item.permissions].sort().join("|") === normalized.join("|")
  )) ?? adminRoleDefinitions.at(-1)!;
}
