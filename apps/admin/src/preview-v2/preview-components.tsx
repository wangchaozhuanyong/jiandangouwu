import {
  ArrowsClockwise,
  Eye,
  LockKey,
  ShieldCheck,
  WarningCircle,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";
import type {
  PreviewLocale,
  PreviewScenario,
} from "./preview-model";

export function previewText(locale: PreviewLocale, zh: string, en: string): string {
  return locale === "zh" ? zh : en;
}

export function PreviewTruthBanner({ locale }: { locale: PreviewLocale }) {
  return (
    <aside className="preview-v2-truth-banner" role="note">
      <Eye aria-hidden="true" size={20} />
      <span>
        <strong>{previewText(locale, "界面设计预览", "Interface design preview")}</strong>
        {previewText(
          locale,
          "本区域只使用 DEMO 模拟数据和当前标签页内存状态，不调用业务接口，也不修改服务器数据。",
          "This area uses DEMO fixtures and in-memory state only. It calls no business endpoint and changes no server data.",
        )}
      </span>
      <em>{previewText(locale, "开发环境", "Development only")}</em>
    </aside>
  );
}

const scenarioCopy: Record<PreviewScenario, { zh: string; en: string }> = {
  ready: { zh: "正常", en: "Ready" },
  "initial-loading": { zh: "加载", en: "Loading" },
  empty: { zh: "空数据", en: "Empty" },
  offline: { zh: "离线", en: "Offline" },
  error: { zh: "失败", en: "Error" },
  forbidden: { zh: "无权限", en: "Forbidden" },
  conflict: { zh: "版本冲突", en: "Conflict" },
};

export function PreviewScenarioBar({
  locale,
  scenario,
  onChange,
}: {
  locale: PreviewLocale;
  scenario: PreviewScenario;
  onChange: (scenario: PreviewScenario) => void;
}) {
  return (
    <div className="preview-v2-scenario-bar">
      <span>{previewText(locale, "界面状态", "Interface state")}</span>
      <div role="group" aria-label={previewText(locale, "切换预览状态", "Switch preview state")}>
        {(Object.keys(scenarioCopy) as PreviewScenario[]).map((item) => (
          <button
            aria-pressed={scenario === item}
            className={scenario === item ? "is-active" : ""}
            key={item}
            onClick={() => onChange(item)}
            type="button"
          >
            {scenarioCopy[item][locale]}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PreviewScenarioSurface({
  children,
  locale,
  onReady,
  scenario,
}: {
  children: ReactNode;
  locale: PreviewLocale;
  onReady: () => void;
  scenario: PreviewScenario;
}) {
  if (scenario === "ready") return <>{children}</>;
  if (scenario === "initial-loading") {
    return (
      <section className="admin-panel preview-v2-state is-loading" aria-busy="true" aria-label={previewText(locale, "正在展示加载状态", "Showing the loading state")}>
        <ArrowsClockwise aria-hidden="true" size={28} />
        <strong>{previewText(locale, "结构加载状态", "Structural loading state")}</strong>
        <div>{Array.from({ length: 5 }, (_, index) => <i key={index} />)}</div>
      </section>
    );
  }

  const stateContent: Record<Exclude<PreviewScenario, "ready" | "initial-loading">, {
    title: { zh: string; en: string };
    body: { zh: string; en: string };
  }> = {
    empty: {
      title: { zh: "没有符合条件的 DEMO 记录", en: "No matching DEMO records" },
      body: { zh: "这是空状态的界面表现，不代表服务器记录数量为零。", en: "This is an empty-state treatment. It does not mean the server has zero records." },
    },
    offline: {
      title: { zh: "离线状态预览", en: "Offline state preview" },
      body: { zh: "没有发起网络请求；此状态仅用于检查离线说明和重试入口。", en: "No network request was made. This state only checks offline guidance and its retry action." },
    },
    error: {
      title: { zh: "失败状态预览", en: "Error state preview" },
      body: { zh: "此处不包含真实错误、追踪编号或服务器响应。", en: "This contains no real error, trace identifier, or server response." },
    },
    forbidden: {
      title: { zh: "无权限状态预览", en: "Forbidden state preview" },
      body: { zh: "仅展示权限不足的布局；当前真实会话权限没有改变。", en: "This only shows the permission-denied layout. The current session permissions are unchanged." },
    },
    conflict: {
      title: { zh: "DEMO 版本冲突界面", en: "DEMO version-conflict interface" },
      body: { zh: "本地草稿与示例版本并列展示；没有读取或覆盖服务器版本。", en: "A local draft and sample version are shown side by side. No server version was read or overwritten." },
    },
  };
  const item = stateContent[scenario];
  return (
    <section className={`admin-panel preview-v2-state is-${scenario}`} role={scenario === "empty" ? "status" : "alert"}>
      {scenario === "forbidden" ? <LockKey aria-hidden="true" size={29} /> : <WarningCircle aria-hidden="true" size={29} />}
      <strong>{item.title[locale]}</strong>
      <p>{item.body[locale]}</p>
      {scenario !== "forbidden" && (
        <button className="admin-secondary" onClick={onReady} type="button">
          {previewText(locale, "返回正常预览", "Return to ready preview")}
        </button>
      )}
    </section>
  );
}

export function PreviewSectionHeading({
  icon,
  title,
  body,
}: {
  icon?: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <header className="preview-v2-section-heading">
      {icon && <span>{icon}</span>}
      <div><h2>{title}</h2><p>{body}</p></div>
    </header>
  );
}

export function PreviewToggle({
  checked,
  disabled = false,
  label,
  description,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  description: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={`preview-v2-toggle${disabled ? " is-disabled" : ""}`}>
      <span><strong>{label}</strong><small>{description}</small></span>
      <input checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      <i aria-hidden="true" />
    </label>
  );
}

export function PreviewBoundaryNote({ locale, children }: { locale: PreviewLocale; children: ReactNode }) {
  return (
    <p className="preview-v2-boundary-note" role="note">
      <ShieldCheck aria-hidden="true" size={18} />
      <span>{children}</span>
      <small>{previewText(locale, "服务器写入：关闭", "Server writes: off")}</small>
    </p>
  );
}
