import type {
  AdminDataGovernanceOverview,
  CreatePrivacyRequestInput,
  PrivacyRequestItem,
  UpdatePrivacyRequestInput,
} from "@cloudbridge/contracts";
import { request } from "../../api";

export const getDataGovernanceOverview = async (
  signal?: AbortSignal,
): Promise<AdminDataGovernanceOverview> => (
  await request<AdminDataGovernanceOverview>("/admin/data-governance", { signal })
).data;

export const createPrivacyRequest = async (
  input: CreatePrivacyRequestInput,
): Promise<PrivacyRequestItem> => (
  await request<PrivacyRequestItem>("/admin/privacy-requests", {
    method: "POST",
    body: JSON.stringify(input),
  })
).data;

export const updatePrivacyRequest = async (
  id: string,
  input: UpdatePrivacyRequestInput,
): Promise<PrivacyRequestItem> => (
  await request<PrivacyRequestItem>(`/admin/privacy-requests/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
).data;

export const runDataKeyRotation = async (
  reason: string,
): Promise<AdminDataGovernanceOverview["keyRotation"]> => (
  await request<AdminDataGovernanceOverview["keyRotation"]>("/admin/data-governance/key-rotation", {
    method: "POST",
    body: JSON.stringify({ reason, confirmation: "ROTATE DATA KEY" }),
  })
).data;
