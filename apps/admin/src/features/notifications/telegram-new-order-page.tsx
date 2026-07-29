import {
  telegramNewOrderFieldCodes,
  type AdminTelegramNewOrderSettings,
  type Locale,
  type TelegramNewOrderFieldCode,
  type TelegramNewOrderSimulation,
  type UpdateAdminTelegramNewOrderSettingsInput,
} from "@cloudbridge/contracts";
import {
  Check,
  Eye,
  ShieldWarning,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
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
import { ApiError } from "../../api";
import {
  getTelegramNewOrderSettings,
  simulateTelegramNewOrder,
  updateTelegramNewOrderSettings,
} from "./api";

type TelegramSettingsForm = UpdateAdminTelegramNewOrderSettingsInput;

const copy = (locale: Locale, zh: string, en: string): string => locale === "zh" ? zh : en;

const fieldLabels: Record<TelegramNewOrderFieldCode, Record<Locale, string>> = {
  ORDER_NUMBER: { zh: "订单号", en: "Order number" },
  PRODUCT: { zh: "商品", en: "Product" },
  AMOUNT: { zh: "金额", en: "Amount" },
  CURRENCY: { zh: "币种", en: "Currency" },
  STATUS: { zh: "订单状态", en: "Order status" },
  CREATED_AT: { zh: "创建时间", en: "Created at" },
  CONTACT_CHANNEL: { zh: "联系渠道", en: "Contact channel" },
  MASKED_CONTACT: { zh: "脱敏联系方式", en: "Masked contact" },
};

const editableSettings = (
  settings: AdminTelegramNewOrderSettings,
): TelegramSettingsForm => ({
  version: settings.version,
  requestedEnabled: settings.requestedEnabled,
  recipientGroupLabel: settings.recipientGroupLabel,
  includedFields: [...settings.includedFields],
  reason: "",
});

const comparableSettings = (settings: TelegramSettingsForm) => ({
  requestedEnabled: settings.requestedEnabled,
  recipientGroupLabel: settings.recipientGroupLabel.trim(),
  includedFields: [...settings.includedFields],
});

const reauthenticationRequired = (error: unknown): boolean => error instanceof ApiError
  && error.status === 403
  && (
    error.code.toLocaleUpperCase().includes("REAUTH")
    || error.message.toLocaleLowerCase().includes("reauth")
  );

export default function TelegramNewOrderPage({
  canWrite,
  locale,
}: {
  canWrite: boolean;
  locale: Locale;
}) {
  const loader = useCallback((signal: AbortSignal) => getTelegramNewOrderSettings(signal), []);
  const {
    commit,
    data,
    reload,
    state,
  } = useCachedAdminResource<AdminTelegramNewOrderSettings>(
    "telegram-new-order-settings",
    loader,
  );
  const slow = useSlowAdminRequest(state);
  const { notify } = useAdminStatus();
  const [form, setForm] = useState<TelegramSettingsForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [simulation, setSimulation] = useState<TelegramNewOrderSimulation | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [simulationError, setSimulationError] = useState("");

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

  const toggleField = (code: TelegramNewOrderFieldCode) => {
    if (!form) return;
    const included = form.includedFields.includes(code);
    const includedFields = included
      ? form.includedFields.filter((item) => item !== code)
      : telegramNewOrderFieldCodes.filter((item) => (
          item === code || form.includedFields.includes(item)
        ));
    setForm({ ...form, includedFields });
    setSaveError("");
    setConflict(false);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canWrite || !data || !form || !dirty || saving) return;
    const normalized: TelegramSettingsForm = {
      ...form,
      recipientGroupLabel: form.recipientGroupLabel.trim(),
      reason: form.reason.trim(),
    };
    if (!normalized.recipientGroupLabel) {
      const message = copy(locale, "接收组标签不能为空。", "Recipient group label is required.");
      setSaveError(message);
      notify(message, "error");
      return;
    }
    if (normalized.includedFields.length === 0) {
      const message = copy(locale, "至少保留一个脱敏白名单字段。", "Keep at least one masked allowlist field.");
      setSaveError(message);
      notify(message, "error");
      return;
    }
    if (normalized.reason.length < 8) {
      const message = copy(locale, "修改原因去除首尾空格后至少 8 个字符。", "Change reason must contain at least 8 characters after trimming.");
      setSaveError(message);
      notify(message, "error");
      return;
    }

    setSaving(true);
    setSaveError("");
    setConflict(false);
    try {
      const response = await updateTelegramNewOrderSettings(normalized);
      commit(response.data);
      setForm(editableSettings(response.data));
      setSimulation(null);
      notify(copy(locale, "未来通知意向配置已保存。", "Future notification intent saved."));
      void reload();
    } catch (requestError) {
      const isConflict = requestError instanceof ApiError && requestError.status === 409;
      const message = isConflict
        ? copy(locale, "配置已被其他管理员修改，请重新加载后再保存。", "Settings changed elsewhere. Reload before saving.")
        : reauthenticationRequired(requestError)
          ? copy(locale, "近期认证已过期，请退出后重新登录，再保存敏感配置。", "Recent authentication expired. Sign out and sign in again before saving sensitive settings.")
          : requestError instanceof ApiError && requestError.status === 403
            ? copy(locale, "当前账号只能查看，不能修改此配置。", "This account can view but cannot change these settings.")
            : copy(locale, "配置未保存，服务器没有确认本次修改。", "Settings were not saved because the server did not confirm the change.");
      setConflict(isConflict);
      setSaveError(message);
      notify(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const simulate = async () => {
    if (simulating || dirty) return;
    setSimulating(true);
    setSimulationError("");
    try {
      setSimulation(await simulateTelegramNewOrder());
    } catch (requestError) {
      const message = requestError instanceof ApiError && requestError.status === 403
        ? copy(locale, "当前账号没有生成服务器模拟预览的权限。", "This account cannot generate a server simulation.")
        : copy(locale, "服务器模拟预览生成失败，没有进行任何外部投递。", "The server simulation failed. No external delivery was attempted.");
      setSimulationError(message);
    } finally {
      setSimulating(false);
    }
  };

  if (!data || !form) {
    return (
      <>
        <TruthNotice locale={locale} />
        <section className="admin-panel">
          <PanelState state={state} locale={locale} retry={() => void reload()} />
        </section>
      </>
    );
  }

  return (
    <>
      <TruthNotice locale={locale} />
      <RefreshNotice state={state} locale={locale} retry={() => void reload()} slow={slow} />
      {saveError && (
        <p className="form-error telegram-settings-error" role="alert">
          <WarningCircle aria-hidden="true" />{saveError}
          {conflict && (
            <button className="admin-secondary" type="button" onClick={() => void reload()}>
              {copy(locale, "重新加载", "Reload")}
            </button>
          )}
        </p>
      )}
      <div className="telegram-settings-layout">
        <form className="admin-panel telegram-settings-form" onSubmit={save}>
          <div className="telegram-panel-heading">
            <div>
              <small>{copy(locale, "新订单事件", "NEW ORDER EVENT")}</small>
              <h2>{copy(locale, "未来通知意向配置", "Future notification intent")}</h2>
              <p>{copy(locale, "仅保存非密钥意向；服务器没有外部投递能力。", "Only non-secret intent is stored; the server has no external delivery capability.")}</p>
            </div>
            <span>{data.eventType}</span>
          </div>

          <fieldset className="telegram-settings-fieldset" disabled={!canWrite}>
            <div className="telegram-intent-row">
              <div>
                <strong>{copy(locale, "记录未来启用意向", "Record future activation intent")}</strong>
                <small>
                  {form.requestedEnabled
                    ? copy(locale, "已请求，但当前状态仍固定为未连接。", "Requested, while the current state remains not connected.")
                    : copy(locale, "当前没有记录未来启用意向。", "No future activation intent is currently recorded.")}
                </small>
              </div>
              <button
                aria-checked={form.requestedEnabled}
                aria-label={copy(locale, "未来启用意向", "Future activation intent")}
                className={`design-switch${form.requestedEnabled ? " is-on" : ""}`}
                role="switch"
                type="button"
                onClick={() => {
                  setForm({ ...form, requestedEnabled: !form.requestedEnabled });
                  setSaveError("");
                  setConflict(false);
                }}
              >
                <i />
              </button>
            </div>
            <label>
              <span>{copy(locale, "接收组标签（仅内部显示名称）", "Recipient group label (internal display name only)")}</span>
              <input
                maxLength={120}
                required
                value={form.recipientGroupLabel}
                onChange={(event) => {
                  setForm({ ...form, recipientGroupLabel: event.target.value });
                  setSaveError("");
                  setConflict(false);
                }}
              />
            </label>
            <fieldset className="telegram-field-allowlist">
              <legend>{copy(locale, "新订单消息白名单字段", "New-order message allowlist")}</legend>
              <p>{copy(locale, "联系方式只允许选择脱敏字段；至少保留一个字段。", "Only masked contact data is available; keep at least one field.")}</p>
              <div>
                {telegramNewOrderFieldCodes.map((code) => (
                  <label key={code}>
                    <input
                      checked={form.includedFields.includes(code)}
                      type="checkbox"
                      onChange={() => toggleField(code)}
                    />
                    <span>{fieldLabels[code][locale]}</span>
                    <code>{code}</code>
                  </label>
                ))}
              </div>
            </fieldset>
            <label>
              <span>{copy(locale, "修改原因（至少 8 个字符，会写入审计）", "Change reason (at least 8 characters, audited)")}</span>
              <textarea
                maxLength={500}
                minLength={8}
                required
                rows={3}
                value={form.reason}
                onChange={(event) => setForm({ ...form, reason: event.target.value })}
              />
            </label>
          </fieldset>

          {canWrite ? (
            <div className="telegram-form-actions">
              {dirty && (
                <button className="admin-secondary" type="button" onClick={() => {
                  setForm(editableSettings(data));
                  setSaveError("");
                  setConflict(false);
                }}>
                  {copy(locale, "撤销更改", "Discard changes")}
                </button>
              )}
              <button className="admin-primary" disabled={!dirty || saving}>
                <Check aria-hidden="true" />
                {saving ? copy(locale, "正在保存", "Saving") : copy(locale, "保存意向配置", "Save intent")}
              </button>
            </div>
          ) : (
            <p className="telegram-readonly-note">
              {copy(locale, "当前账号为只读权限。", "This account has read-only access.")}
            </p>
          )}
        </form>

        <aside className="admin-panel telegram-connection-status">
          <ShieldWarning aria-hidden="true" />
          <small>{copy(locale, "服务器强制状态", "SERVER-ENFORCED STATE")}</small>
          <h2>NOT_CONNECTED</h2>
          <p>{copy(locale, "即使保存未来启用意向，下列运行状态也不会改变。", "Saving future activation intent does not change these runtime states.")}</p>
          <dl>
            <div>
              <dt>{copy(locale, "实际生效", "Effective")}</dt>
              <dd>{copy(locale, "否", "No")}</dd>
            </div>
            <div>
              <dt>{copy(locale, "凭据已配置", "Credential configured")}</dt>
              <dd>{copy(locale, "否", "No")}</dd>
            </div>
            <div>
              <dt>{copy(locale, "外部投递已核验", "External delivery verified")}</dt>
              <dd>{copy(locale, "否", "No")}</dd>
            </div>
            <div>
              <dt>{copy(locale, "最后更新", "Last updated")}</dt>
              <dd>
                {data.version === 0
                  ? copy(locale, "尚未保存", "Never saved")
                  : formatDate(data.updatedAt, locale)}
              </dd>
            </div>
          </dl>
        </aside>
      </div>

      <section className="admin-panel telegram-simulation-panel">
        <div className="telegram-panel-heading">
          <div>
            <small>SIMULATED</small>
            <h2>{copy(locale, "服务器脱敏模拟预览", "Server-generated masked simulation")}</h2>
            <p>{copy(locale, "使用服务器固定的虚构订单，不读取真实客户联系方式，也不会尝试外部投递。", "Uses a fixed fictional server order, never reads a real customer contact, and never attempts external delivery.")}</p>
          </div>
          <button
            className="admin-secondary"
            disabled={dirty || simulating}
            title={dirty ? copy(locale, "请先保存或撤销当前更改", "Save or discard current changes first") : undefined}
            type="button"
            onClick={() => void simulate()}
          >
            <Eye aria-hidden="true" />
            {simulating ? copy(locale, "正在生成", "Generating") : copy(locale, "生成模拟预览", "Generate simulation")}
          </button>
        </div>
        {simulationError && <p className="form-error telegram-simulation-error" role="alert"><WarningCircle aria-hidden="true" />{simulationError}</p>}
        {simulation ? (
          <div className="telegram-simulation-result" role="status">
            <div className="telegram-simulation-meta">
              <span><strong>SIMULATED</strong></span>
              <span>{copy(locale, "固定虚构订单", "Fixed fictional order")}</span>
              <span>
                {copy(locale, "外部投递已尝试", "External delivery attempted")} ·{" "}
                {copy(locale, "否", "No")}
              </span>
              <span>
                {copy(locale, "外部投递已核验", "External delivery verified")} ·{" "}
                {copy(locale, "否", "No")}
              </span>
            </div>
            <dl>
              {simulation.fields.map((field) => (
                <div key={field.code}>
                  <dt>{fieldLabels[field.code][locale]}</dt>
                  <dd>{field.value}</dd>
                </div>
              ))}
            </dl>
            <small>{copy(locale, "生成时间", "Generated")} · {formatDate(simulation.generatedAt, locale)}</small>
          </div>
        ) : (
          <div className="telegram-simulation-empty">
            {copy(locale, "尚未生成模拟预览。页面不会显示虚构的投递结果。", "No simulation generated yet. The page does not fabricate a delivery result.")}
          </div>
        )}
      </section>
    </>
  );
}

function TruthNotice({ locale }: { locale: Locale }) {
  return (
    <div className="telegram-truth-note" role="note">
      <WarningCircle aria-hidden="true" />
      <span>
        <strong>{copy(locale, "Telegram 新订单通知尚未接通", "Telegram new-order notifications are not connected")}</strong>
        {copy(
          locale,
          "这里只保存未来启用意向和脱敏白名单；Bot 与接收群组均未接通，当前没有发送 Telegram 消息。",
          "This page stores only future activation intent and a masked allowlist. The bot and recipient group are not connected, and no Telegram message has been sent.",
        )}
      </span>
    </div>
  );
}
