import "../../../admin/src/styles.css";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin-surface">{children}</div>;
}
