export const privacyRequestTypes = ["ACCESS", "CORRECTION", "ERASURE"] as const;
export type PrivacyRequestType = (typeof privacyRequestTypes)[number];
export const privacyRequestStatuses = [
  "RECEIVED",
  "IDENTITY_VERIFIED",
  "IN_PROGRESS",
  "COMPLETED",
  "REJECTED",
] as const;
export type PrivacyRequestStatus = (typeof privacyRequestStatuses)[number];

export type DataRetentionDraft = {
  enabled: false;
  contactAnonymizeAfterDays: 180;
  orderRetentionDays: 730;
  auditRetentionDays: 365;
  telegramRetentionDays: 90;
  backupRetentionDays: 30;
  version: number;
  updatedAt: string;
};

export type DataCleanupPreview = {
  generatedAt: string;
  writesPerformed: false;
  contactsEligible: number;
  ordersEligible: number;
  auditEventsEligible: number;
  telegramDeliveriesEligible: number;
  backupsEligible: number;
  oldestEligibleAt: string | null;
};

export type PrivacyRequestItem = {
  id: string;
  type: PrivacyRequestType;
  status: PrivacyRequestStatus;
  requesterReference: string;
  result: {
    action: "EXPORTED" | "CORRECTED" | "ANONYMIZED";
    affectedOrders: number;
    exportedOrders?: ReadonlyArray<{
      orderNumber: string;
      status: string;
      contactChannel: string;
      maskedContact: string;
      createdAt: string;
    }>;
  } | null;
  identityVerifiedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreatePrivacyRequestInput = {
  type: PrivacyRequestType;
  requesterReference: string;
  reason: string;
};

export type UpdatePrivacyRequestInput = {
  status: PrivacyRequestStatus;
  reason: string;
  confirmation?: string;
  correctedReference?: string;
};

export type DataKeyRotationStatus = {
  state: "READY" | "NEXT_KEY_MISSING" | "RUNNING" | "COMPLETED" | "FAILED";
  activeKeyId: string | null;
  nextKeyId: string | null;
  contactsRemaining: number;
  backupsRemaining: number;
  lastRotatedAt: string | null;
  lastErrorCode: string | null;
};

export type AdminDataGovernanceOverview = {
  retention: DataRetentionDraft;
  cleanupPreview: DataCleanupPreview;
  privacyRequests: ReadonlyArray<PrivacyRequestItem>;
  keyRotation: DataKeyRotationStatus;
};
