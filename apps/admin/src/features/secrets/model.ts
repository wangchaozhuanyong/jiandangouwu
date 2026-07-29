export const secretDomainCodes = [
  "DATABASE_CREDENTIALS",
  "CACHE_AUTHENTICATION",
  "ADMIN_SESSION",
  "APPLICATION_ENCRYPTION",
] as const;
export type SecretDomainCode = (typeof secretDomainCodes)[number];

export const secretControlCodes = [
  "SERVER_ONLY_INJECTION",
  "TASK_ROLE_READ_GRANTS",
  "FRONTEND_SECRET_ISOLATION",
  "VALUELESS_ADMIN_PROJECTION",
] as const;
export type SecretControlCode = (typeof secretControlCodes)[number];

export const secretGateCodes = [
  "AWS_DEPLOYMENT_EVIDENCE",
  "RUNTIME_SECRET_METADATA",
  "AUTOMATED_ROTATION",
  "KEY_DOMAIN_SEPARATION",
  "CUSTOMER_MANAGED_KMS",
  "INCIDENT_AND_ROLLBACK_RUNBOOK",
] as const;
export type SecretGateCode = (typeof secretGateCodes)[number];

export type SecretBinding = {
  code: string;
  domain: SecretDomainCode;
  productionSource: "RDS_GENERATED_SECRET" | "SECRETS_MANAGER_SECRET";
  consumer: "API_TASK";
  infrastructureState: "DEFINED_INFRA";
  runtimeState: "NOT_DEPLOYED";
  rotationState: "NOT_IMPLEMENTED";
};

export const productionSecretBindings: ReadonlyArray<SecretBinding> = [
  {
    code: "DB_HOST",
    domain: "DATABASE_CREDENTIALS",
    productionSource: "RDS_GENERATED_SECRET",
    consumer: "API_TASK",
    infrastructureState: "DEFINED_INFRA",
    runtimeState: "NOT_DEPLOYED",
    rotationState: "NOT_IMPLEMENTED",
  },
  {
    code: "DB_USER",
    domain: "DATABASE_CREDENTIALS",
    productionSource: "RDS_GENERATED_SECRET",
    consumer: "API_TASK",
    infrastructureState: "DEFINED_INFRA",
    runtimeState: "NOT_DEPLOYED",
    rotationState: "NOT_IMPLEMENTED",
  },
  {
    code: "DB_PASSWORD",
    domain: "DATABASE_CREDENTIALS",
    productionSource: "RDS_GENERATED_SECRET",
    consumer: "API_TASK",
    infrastructureState: "DEFINED_INFRA",
    runtimeState: "NOT_DEPLOYED",
    rotationState: "NOT_IMPLEMENTED",
  },
  {
    code: "REDIS_PASSWORD",
    domain: "CACHE_AUTHENTICATION",
    productionSource: "SECRETS_MANAGER_SECRET",
    consumer: "API_TASK",
    infrastructureState: "DEFINED_INFRA",
    runtimeState: "NOT_DEPLOYED",
    rotationState: "NOT_IMPLEMENTED",
  },
  {
    code: "SESSION_SECRET",
    domain: "ADMIN_SESSION",
    productionSource: "SECRETS_MANAGER_SECRET",
    consumer: "API_TASK",
    infrastructureState: "DEFINED_INFRA",
    runtimeState: "NOT_DEPLOYED",
    rotationState: "NOT_IMPLEMENTED",
  },
  {
    code: "AUTH_ENCRYPTION_KEY",
    domain: "APPLICATION_ENCRYPTION",
    productionSource: "SECRETS_MANAGER_SECRET",
    consumer: "API_TASK",
    infrastructureState: "DEFINED_INFRA",
    runtimeState: "NOT_DEPLOYED",
    rotationState: "NOT_IMPLEMENTED",
  },
];

export type SecretReadiness = {
  sourceCount: number;
  productionBindingCount: number;
  frontendBindingCount: 0;
  automatedRotationCount: 0;
  controls: ReadonlyArray<{
    code: SecretControlCode;
    state: "IMPLEMENTED_CODE";
  }>;
  gates: ReadonlyArray<{
    code: SecretGateCode;
    state: "NOT_DEPLOYED" | "NOT_IMPLEMENTED" | "NOT_DEFINED";
  }>;
  bindings: ReadonlyArray<SecretBinding>;
};

export function buildSecretReadiness(): SecretReadiness {
  return {
    sourceCount: secretDomainCodes.length,
    productionBindingCount: productionSecretBindings.length,
    frontendBindingCount: 0,
    automatedRotationCount: 0,
    controls: secretControlCodes.map((code) => ({
      code,
      state: "IMPLEMENTED_CODE",
    })),
    gates: [
      { code: "AWS_DEPLOYMENT_EVIDENCE", state: "NOT_DEPLOYED" },
      { code: "RUNTIME_SECRET_METADATA", state: "NOT_IMPLEMENTED" },
      { code: "AUTOMATED_ROTATION", state: "NOT_IMPLEMENTED" },
      { code: "KEY_DOMAIN_SEPARATION", state: "NOT_IMPLEMENTED" },
      { code: "CUSTOMER_MANAGED_KMS", state: "NOT_DEFINED" },
      { code: "INCIDENT_AND_ROLLBACK_RUNBOOK", state: "NOT_DEFINED" },
    ],
    bindings: productionSecretBindings,
  };
}
