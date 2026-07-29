import type {
  AdminStorefrontSettings,
  Locale,
  UpdateStorefrontSettingsInput,
} from "@cloudbridge/contracts";
import {
  Check,
  Globe,
  SlidersHorizontal,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ApiError } from "../../api";
import {
  useAdminPageDirty,
  useAdminStatus,
  useCachedAdminResource,
  useSlowAdminRequest,
} from "../../admin-experience";
import {
  formatDate,
  PanelState,
  RefreshNotice,
  useUnsavedChanges,
} from "../../admin-ui";
import { getSiteSettings, updateSiteSettings } from "./api";

type SettingsSection = "brand" | "access" | "seo";

const copy = (locale: Locale, zh: string, en: string) => locale === "zh" ? zh : en;
const policyVersionPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/u;

const editableSettings = (
  settings: AdminStorefrontSettings,
): UpdateStorefrontSettingsInput => ({
  version: settings.version,
  siteName: settings.siteName,
  defaultLocale: settings.defaultLocale,
  seoDescription: settings.seoDescription,
  policyVersion: settings.policyVersion,
  acceptOrders: settings.acceptOrders,
  supportEnabled: settings.supportEnabled,
  transitServiceEnabled: settings.transitServiceEnabled,
  transitServiceUrl: settings.transitServiceUrl,
  reason: "",
});

const comparableSettings = (settings: UpdateStorefrontSettingsInput) => ({
  siteName: settings.siteName,
  defaultLocale: settings.defaultLocale,
  seoDescription: settings.seoDescription,
  policyVersion: settings.policyVersion,
  acceptOrders: settings.acceptOrders,
  supportEnabled: settings.supportEnabled,
  transitServiceEnabled: settings.transitServiceEnabled,
  transitServiceUrl: settings.transitServiceUrl,
});

type SettingsValidationResult =
  | { ok: true; value: UpdateStorefrontSettingsInput }
  | { ok: false; section: SettingsSection; message: string };

const validateSettings = (
  form: UpdateStorefrontSettingsInput,
  locale: Locale,
): SettingsValidationResult => {
  const normalized: UpdateStorefrontSettingsInput = {
    ...form,
    siteName: {
      zh: form.siteName.zh.trim(),
      en: form.siteName.en.trim(),
    },
    seoDescription: {
      zh: form.seoDescription.zh.trim(),
      en: form.seoDescription.en.trim(),
    },
    policyVersion: form.policyVersion.trim(),
    transitServiceUrl: form.transitServiceUrl?.trim() || null,
    reason: form.reason.trim(),
  };

  if (!normalized.siteName.zh
    || !normalized.siteName.en
    || normalized.siteName.zh.length > 120
    || normalized.siteName.en.length > 120) {
    return {
      ok: false,
      section: "brand",
      message: copy(locale, "中英文站点名称均为必填，且不能只包含空格。", "Both site names are required and cannot be blank."),
    };
  }
  if (normalized.defaultLocale !== "zh" && normalized.defaultLocale !== "en") {
    return {
      ok: false,
      section: "brand",
      message: copy(locale, "请选择有效的默认语言。", "Choose a valid default language."),
    };
  }
  if (!normalized.seoDescription.zh
    || !normalized.seoDescription.en
    || normalized.seoDescription.zh.length > 500
    || normalized.seoDescription.en.length > 500) {
    return {
      ok: false,
      section: "seo",
      message: copy(locale, "中英文 SEO 描述均为必填，且不能只包含空格。", "Both SEO descriptions are required and cannot be blank."),
    };
  }
  if (!policyVersionPattern.test(normalized.policyVersion)) {
    return {
      ok: false,
      section: "seo",
      message: copy(locale, "政策版本必须以字母或数字开头，只能包含字母、数字、点、下划线和短横线。", "Policy version must start with a letter or number and use only letters, numbers, dots, underscores, or hyphens."),
    };
  }
  if (normalized.transitServiceUrl) {
    try {
      const parsed = new URL(normalized.transitServiceUrl);
      if (
        parsed.protocol !== "https:"
        || !parsed.hostname
        || parsed.username
        || parsed.password
        || parsed.toString().length > 500
      ) {
        throw new Error("unsafe URL");
      }
      normalized.transitServiceUrl = parsed.toString();
    } catch {
      return {
        ok: false,
        section: "access",
        message: copy(locale, "中转站地址必须是无账号密码的安全 HTTPS 地址。", "Transit URL must be a safe HTTPS URL without embedded credentials."),
      };
    }
  }
  if (normalized.reason.length < 8 || normalized.reason.length > 500) {
    return {
      ok: false,
      section: "seo",
      message: copy(locale, "修改原因去除首尾空格后至少 8 个字符。", "Change reason must contain at least 8 characters after trimming."),
    };
  }
  return { ok: true, value: normalized };
};

export default function SettingsPage({ canWrite, locale }: { canWrite: boolean; locale: Locale }) {
  const loader = useCallback((signal: AbortSignal) => getSiteSettings(signal), []);
  const { commit, data, state, reload } = useCachedAdminResource<AdminStorefrontSettings>("site-settings", loader);
  const slow = useSlowAdminRequest(state);
  const { notify } = useAdminStatus();
  const [section, setSection] = useState<SettingsSection>("brand");
  const [form, setForm] = useState<UpdateStorefrontSettingsInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (data) setForm(editableSettings(data));
  }, [data]);

  const dirty = useMemo(() => Boolean(
    data
    && form
    && JSON.stringify(comparableSettings(form))
      !== JSON.stringify(comparableSettings(editableSettings(data))),
  ), [data, form]);
  useUnsavedChanges(dirty);
  useAdminPageDirty(dirty);

  const sections: Array<{ id: SettingsSection; label: string }> = [
    { id: "brand", label: copy(locale, "品牌与语言", "Brand & language") },
    { id: "access", label: copy(locale, "订单与入口", "Orders & access") },
    { id: "seo", label: copy(locale, "SEO 与政策", "SEO & policy") },
  ];

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canWrite || !data || !form || !dirty || busy) return;
    const validation = validateSettings(form, locale);
    if (!validation.ok) {
      setSection(validation.section);
      setError(validation.message);
      notify(validation.message, "error");
      return;
    }
    const normalized = validation.value;
    const sensitiveChange = data.acceptOrders !== normalized.acceptOrders
      || data.supportEnabled !== normalized.supportEnabled
      || data.transitServiceEnabled !== normalized.transitServiceEnabled
      || data.transitServiceUrl !== normalized.transitServiceUrl
      || data.policyVersion !== normalized.policyVersion;
    if (sensitiveChange && !window.confirm(copy(
      locale,
      "这些修改会直接影响客户端入口或新订单。确认保存并记录审计日志吗？",
      "These changes affect storefront access or new orders. Save and audit them?",
    ))) return;

    setBusy(true);
    setError("");
    try {
      const response = await updateSiteSettings(normalized);
      commit(response.data);
      setForm(editableSettings(response.data));
      notify(copy(locale, "网站设置已保存。", "Site settings saved."));
      void reload();
    } catch (requestError) {
      const message = requestError instanceof ApiError && requestError.status === 409
        ? copy(locale, "网站设置已被其他管理员修改，请重新加载后再保存。", "Site settings changed elsewhere. Reload before saving.")
        : requestError instanceof ApiError && requestError.status === 403
          ? copy(locale, "当前账号没有修改网站设置的权限。", "This account cannot change site settings.")
          : copy(locale, "网站设置未保存，请检查必填字段和 HTTPS 地址。", "Site settings were not saved. Check required fields and the HTTPS URL.");
      setError(message);
      notify(message, "error");
    } finally {
      setBusy(false);
    }
  };

  if (!data || !form) {
    return (
      <section className="admin-panel">
        <PanelState state={state} locale={locale} retry={() => void reload()} />
      </section>
    );
  }

  return (
    <form onSubmit={save}>
      <div className="real-page-toolbar">
        <span>{copy(locale, "最后更新", "Last updated")} · {formatDate(data.updatedAt, locale)}</span>
        {canWrite && (
          <div>
            {dirty && (
              <button className="admin-secondary" type="button" onClick={() => {
                setForm(editableSettings(data));
                setError("");
              }}>
                {copy(locale, "撤销更改", "Discard changes")}
              </button>
            )}
            <button className="admin-primary" disabled={!dirty || busy}>
              <Check size={17} />{busy ? copy(locale, "正在保存", "Saving") : copy(locale, "保存网站设置", "Save settings")}
            </button>
          </div>
        )}
      </div>
      <RefreshNotice state={state} locale={locale} retry={() => void reload()} slow={slow} />
      {error && <p className="form-error real-page-error" role="alert"><WarningCircle />{error}</p>}
      <div className="design-settings-layout real-settings-layout">
        <nav className="admin-panel" aria-label={copy(locale, "设置分区", "Settings sections")}>
          {sections.map((item) => (
            <button
              className={section === item.id ? "is-active" : ""}
              aria-current={section === item.id ? "page" : undefined}
              key={item.id}
              onClick={() => setSection(item.id)}
              type="button"
            >
              {item.label}<span>›</span>
            </button>
          ))}
        </nav>

        <section className="admin-panel design-settings-form">
          <div>
            <small>{sections.find((item) => item.id === section)?.label}</small>
            <h2>{copy(locale, "真实网站配置", "Live site configuration")}</h2>
            <p>{copy(locale, "保存后，客户端在下次读取公开配置时生效。", "Changes apply when the storefront next reads public configuration.")}</p>
          </div>

          <fieldset className="settings-editable-fieldset" disabled={!canWrite}>
            {section === "brand" && (
              <>
                <div className="form-grid two">
                  <label><span>{copy(locale, "中文站点名称", "Chinese site name")}</span><input value={form.siteName.zh} onChange={(event) => setForm({ ...form, siteName: { ...form.siteName, zh: event.target.value } })} maxLength={120} required /></label>
                  <label><span>{copy(locale, "英文站点名称", "English site name")}</span><input value={form.siteName.en} onChange={(event) => setForm({ ...form, siteName: { ...form.siteName, en: event.target.value } })} maxLength={120} required /></label>
                </div>
                <label>
                  <span>{copy(locale, "默认语言", "Default language")}</span>
                  <select value={form.defaultLocale} onChange={(event) => setForm({ ...form, defaultLocale: event.target.value as Locale })}>
                    <option value="zh">简体中文</option>
                    <option value="en">English</option>
                  </select>
                </label>
              </>
            )}

            {section === "access" && (
              <>
                <SettingsSwitch
                  checked={form.acceptOrders}
                  description={copy(locale, "关闭后商品仍可浏览，但 API 和客户端都拒绝新订单。", "Products stay visible, but both API and storefront reject new orders.")}
                  label={copy(locale, "接受新订单", "Accept new orders")}
                  onChange={(value) => setForm({ ...form, acceptOrders: value })}
                />
                <SettingsSwitch
                  checked={form.supportEnabled}
                  description={copy(locale, "控制页头和页脚的客服入口，不删除已配置渠道。", "Controls support entry points without deleting channels.")}
                  label={copy(locale, "显示客服入口", "Show support access")}
                  onChange={(value) => setForm({ ...form, supportEnabled: value })}
                />
                <SettingsSwitch
                  checked={form.transitServiceEnabled}
                  description={copy(locale, "只有明确关闭时才隐藏中转站入口。", "The transit entry hides only when explicitly disabled.")}
                  label={copy(locale, "显示中转站服务", "Show transit service")}
                  onChange={(value) => setForm({ ...form, transitServiceEnabled: value })}
                />
                <label>
                  <span>{copy(locale, "中转站 HTTPS 地址（可留空）", "Transit HTTPS URL (optional)")}</span>
                  <input
                    type="url"
                    value={form.transitServiceUrl ?? ""}
                    onChange={(event) => setForm({ ...form, transitServiceUrl: event.target.value || null })}
                    placeholder="https://"
                    maxLength={500}
                  />
                </label>
              </>
            )}

            {section === "seo" && (
              <>
                <label><span>{copy(locale, "中文 SEO 描述", "Chinese SEO description")}</span><textarea rows={4} value={form.seoDescription.zh} onChange={(event) => setForm({ ...form, seoDescription: { ...form.seoDescription, zh: event.target.value } })} maxLength={500} required /></label>
                <label><span>{copy(locale, "英文 SEO 描述", "English SEO description")}</span><textarea rows={4} value={form.seoDescription.en} onChange={(event) => setForm({ ...form, seoDescription: { ...form.seoDescription, en: event.target.value } })} maxLength={500} required /></label>
                <label><span>{copy(locale, "当前政策版本", "Current policy version")}</span><input value={form.policyVersion} onChange={(event) => setForm({ ...form, policyVersion: event.target.value })} pattern="[A-Za-z0-9][A-Za-z0-9._-]{0,79}" maxLength={80} required /></label>
              </>
            )}

            <label className="settings-reason">
              <span>{copy(locale, "修改原因（至少 8 个字符，会写入审计）", "Change reason (at least 8 characters, written to audit)")}</span>
              <textarea value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} minLength={8} maxLength={500} rows={3} required />
            </label>
          </fieldset>
        </section>

        <aside className="admin-panel design-settings-preview">
          <span><Globe size={23} /></span>
          <small>{copy(locale, "影响摘要", "IMPACT SUMMARY")}</small>
          <h2>{form.siteName[locale]}</h2>
          <p>{form.seoDescription[locale]}</p>
          <dl>
            <div><dt>{copy(locale, "默认语言", "Default locale")}</dt><dd>{form.defaultLocale.toUpperCase()}</dd></div>
            <div><dt>{copy(locale, "新订单", "New orders")}</dt><dd>{form.acceptOrders ? copy(locale, "接受", "Accepted") : copy(locale, "暂停", "Paused")}</dd></div>
            <div><dt>{copy(locale, "客服入口", "Support access")}</dt><dd>{form.supportEnabled ? copy(locale, "显示", "Visible") : copy(locale, "隐藏", "Hidden")}</dd></div>
            <div><dt>{copy(locale, "中转站", "Transit service")}</dt><dd>{form.transitServiceEnabled ? copy(locale, "显示", "Visible") : copy(locale, "隐藏", "Hidden")}</dd></div>
            <div><dt>{copy(locale, "政策版本", "Policy version")}</dt><dd>{form.policyVersion}</dd></div>
          </dl>
          <div className="design-settings-warning">
            <SlidersHorizontal size={17} />
            {copy(locale, "这里显示的是待保存内容；只有服务器确认后才会提示成功。", "This is the pending configuration. Success appears only after server confirmation.")}
          </div>
        </aside>
      </div>
    </form>
  );
}

function SettingsSwitch({
  checked,
  description,
  label,
  onChange,
}: {
  checked: boolean;
  description: string;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="design-setting-row">
      <div><strong>{label}</strong><small>{description}</small></div>
      <button
        aria-label={label}
        aria-checked={checked}
        className={`design-switch${checked ? " is-on" : ""}`}
        onClick={() => onChange(!checked)}
        role="switch"
        type="button"
      >
        <i />
      </button>
    </div>
  );
}
