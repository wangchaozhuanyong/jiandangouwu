import { requireChatGPTUser } from "../../chatgpt-auth";
import { SitesAdminClient } from "./sites-admin-client";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireChatGPTUser("/admin");
  return <SitesAdminClient />;
}
