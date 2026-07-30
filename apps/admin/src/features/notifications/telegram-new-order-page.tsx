import {
  telegramNewOrderFieldCodes,
  type AdminTelegramNewOrderSettings,
  type Locale,
  type TelegramConnectionTest,
  type TelegramDeliveryItem,
  type TelegramNewOrderFieldCode,
  type TelegramNewOrderSimulation,
  type UpdateAdminTelegramNewOrderSettingsInput,
} from "@cloudbridge/contracts";
import {
  ArrowClockwise,
  Check,
  Eye,
  PaperPlaneTilt,
  ShieldCheck,
  WarningCircle,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  getTelegramDeliveries,
  getTelegramNewOrderSettings,
  retryTelegramDelivery,
  simulateTelegramNewOrder,
  testTelegramConnection,
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
  MASKED_CONTACT: { zh: "联系方式", en: "Contact" },
};

const editableSettings = (settings: AdminTelegramNewOrderSettings): TelegramSettingsForm => ({
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

export default function TelegramNewOrderPage({
  canWrite,
  locale,
}: {
  canWrite: boolean;
  locale: Locale;
}) {
  const settingsLoader = useCallback(
    (signal: AbortSignal) => getTelegramNewOrderSettings(signal),
    [],
  );
  const deliveryLoader = useCallback(
    (signal: AbortSignal) => getTelegramDeliveries(signal),
    [],
  );
  const settingsResource = useCachedAdminResource<AdminTelegramNewOrderSettings>(
    "telegram-new-order-settings",
    settingsLoader,
  );
  const deliveryResource = useCachedAdminResource<TelegramDeliveryItem[]>(
    "telegram-deliveries",
    deliveryLoader,
  );
  const { notify } = useAdminStatus();
  const [form, setForm] = useState<TelegramSettingsForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [simulation, setSimulation] = useState<TelegramNewOrderSimulation | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testReason, setTestReason] = useState("");
  const [testResult, setTestResult] = useState<TelegramConnectionTest | null>(null);
  const [actionError, setActionError] = useState("");
  const data = settingsResource.data;
  const slow = useSlowAdminRequest(settingsResource.state);

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

  if (!data || !form) {
    return (
      <>
        <section className="admin-panel">
          <PanelState
            state={settingsResource.state}
            locale={locale}
            retry={() => void settingsResource.reload()}
          />
        </section>
      </>
    );
  }

  const toggleField = (code: TelegramNewOrderFieldCode) => {
    const includedFields = form.includedFields.includes(code)
      ? form.includedFields.filter((item) => item !== code)
      : telegramNewOrderFieldCodes.filter(
          (item) => item === code || form.includedFields.includes(item),
        );
    setForm({ ...form, includedFields });
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canWrite || !dirty || saving) return;
    const normalized = {
      ...form,
      recipientGroupLabel: form.recipientGroupLabel.trim(),
      reason: form.reason.trim(),
    };
    if (!normalized.recipientGroupLabel || normalized.includedFields.length === 0 || normalized.reason.length < 8) {
      setSaveError(copy(
        locale,
        "请填写群组名称、至少一个消息字段和不少于 8 个字符的修改原因。",
        "Provide a group name, at least one message field, and an 8-character reason.",
      ));
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const response = await updateTelegramNewOrderSettings(normalized);
      settingsResource.commit(response.data);
      setForm(editableSettings(response.data));
      notify(copy(locale, "Telegram 通知配置已保存。", "Telegram notification settings saved."));
    } catch (error) {
      setSaveError(error instanceof ApiError
        ? error.message
        : copy(locale, "配置未保存。", "Settings were not saved."));
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    const reason = testReason.trim();
    if (!canWrite || testing || dirty || reason.length < 8) {
      setActionError(copy(
        locale,
        "请先保存更改，并填写不少于 8 个字符的测试原因。",
        "Save changes first and provide an 8-character test reason.",
      ));
      return;
    }
    setTesting(true);
    setActionError("");
    try {
      setTestResult(await testTelegramConnection(reason));
      setTestReason("");
      await settingsResource.reload();
      notify(copy(locale, "真实测试消息已发送并取得回执。", "A real test message was delivered and acknowledged."));
    } catch (error) {
      setActionError(error instanceof ApiError
        ? error.message
        : copy(locale, "真实连接测试失败。", "The real connection test failed."));
    } finally {
      setTesting(false);
    }
  };

  const simulate = async () => {
    if (simulating || dirty) return;
    setSimulating(true);
    setActionError("");
    try {
      setSimulation(await simulateTelegramNewOrder());
    } catch (error) {
      setActionError(error instanceof ApiError
        ? error.message
        : copy(locale, "模拟预览生成失败。", "The simulation could not be generated."));
    } finally {
      setSimulating(false);
    }
  };

  const retry = async (item: TelegramDeliveryItem) => {
    const reason = window.prompt(copy(
      locale,
      "填写本次人工重试原因（至少 8 个字符）",
      "Enter a retry reason (at least 8 characters)",
    ))?.trim() ?? "";
    if (reason.length < 8) return;
    try {
      await retryTelegramDelivery(item.id, reason);
      await deliveryResource.reload();
      notify(copy(locale, "通知已重新进入可靠投递队列。", "The notification returned to the reliable delivery queue."));
    } catch (error) {
      notify(error instanceof ApiError ? error.message : copy(locale, "重试失败。", "Retry failed."), "error");
    }
  };

  return (
    <>
      <div className={`telegram-truth-note${data.connectionState === "CONNECTED" ? " is-connected" : ""}`} role="note">
        {data.connectionState === "CONNECTED"
          ? <ShieldCheck aria-hidden="true" />
          : <WarningCircle aria-hidden="true" />}
        <span>
          <strong>
            {data.connectionState === "CONNECTED"
              ? copy(locale, "Telegram 已真实接通", "Telegram is connected")
              : copy(locale, "Telegram 尚未完成真实连接", "Telegram is not fully connected")}
          </strong>
          {data.connectionState === "MISSING_SECRETS"
            ? copy(locale, "生产密钥尚未配置，通知保持关闭。", "Production secrets are missing, so delivery remains disabled.")
            : data.connectionState === "UNVERIFIED"
              ? copy(locale, "密钥已配置，发送真实测试消息后才能启用。", "Secrets are configured; send a real test before enabling delivery.")
              : data.effectiveEnabled
                ? copy(locale, "新订单将进入可靠队列，消息只包含脱敏白名单字段。", "New orders enter the reliable queue with masked allowlisted fields only.")
                : copy(locale, "连接已验证，但通知启用开关仍关闭。", "The connection is verified, while notification delivery remains disabled.")}
        </span>
      </div>
      <RefreshNotice
        state={settingsResource.state}
        locale={locale}
        retry={() => void settingsResource.reload()}
        slow={slow}
      />
      {(saveError || actionError) && (
        <p className="form-error telegram-settings-error" role="alert">
          <WarningCircle aria-hidden="true" />{saveError || actionError}
        </p>
      )}
      <div className="telegram-settings-layout">
        <form className="admin-panel telegram-settings-form" onSubmit={save}>
          <div className="telegram-panel-heading">
            <div>
              <small>{data.eventType}</small>
              <h2>{copy(locale, "新订单通知配置", "New-order notification settings")}</h2>
              <p>{copy(locale, "敏感凭据由 Sites 管理，本页只保存群组标签和脱敏消息字段。", "Sites manages secrets; this page stores only the group label and masked fields.")}</p>
            </div>
          </div>
          <fieldset className="telegram-settings-fieldset" disabled={!canWrite}>
            <div className="telegram-intent-row">
              <div>
                <strong>{copy(locale, "启用真实新订单通知", "Enable real new-order delivery")}</strong>
                <small>{data.externalDeliveryVerified
                  ? copy(locale, "连接已经过真实消息验证。", "The connection has a real delivery receipt.")
                  : copy(locale, "未通过真实测试前，此开关不会实际生效。", "This cannot take effect before a real test succeeds.")}</small>
              </div>
              <button
                aria-checked={form.requestedEnabled}
                aria-label={copy(locale, "启用 Telegram 通知", "Enable Telegram notifications")}
                className={`design-switch${form.requestedEnabled ? " is-on" : ""}`}
                role="switch"
                type="button"
                onClick={() => setForm({ ...form, requestedEnabled: !form.requestedEnabled })}
              ><i /></button>
            </div>
            <label>
              <span>{copy(locale, "接收群组名称", "Recipient group name")}</span>
              <input
                maxLength={120}
                required
                value={form.recipientGroupLabel}
                onChange={(event) => setForm({ ...form, recipientGroupLabel: event.target.value })}
              />
            </label>
            <fieldset className="telegram-field-allowlist">
              <legend>{copy(locale, "消息白名单字段", "Message allowlist")}</legend>
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
              <span>{copy(locale, "修改原因（至少 8 个字符）", "Change reason (at least 8 characters)")}</span>
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
          {canWrite && (
            <div className="telegram-form-actions">
              <button className="admin-primary" disabled={!dirty || saving}>
                <Check aria-hidden="true" />
                {saving ? copy(locale, "正在保存", "Saving") : copy(locale, "保存配置", "Save settings")}
              </button>
            </div>
          )}
        </form>

        <aside className="admin-panel telegram-connection-status">
          <ShieldCheck aria-hidden="true" />
          <small>{copy(locale, "服务器真实状态", "SERVER STATE")}</small>
          <h2>{data.connectionState}</h2>
          <dl>
            <div><dt>{copy(locale, "实际生效", "Effective")}</dt><dd>{data.effectiveEnabled ? copy(locale, "是", "Yes") : copy(locale, "否", "No")}</dd></div>
            <div><dt>{copy(locale, "凭据已配置", "Secrets configured")}</dt><dd>{data.tokenConfigured ? copy(locale, "是", "Yes") : copy(locale, "否", "No")}</dd></div>
            <div><dt>{copy(locale, "真实投递已验证", "Real delivery verified")}</dt><dd>{data.externalDeliveryVerified ? copy(locale, "是", "Yes") : copy(locale, "否", "No")}</dd></div>
            <div><dt>{copy(locale, "群组", "Group")}</dt><dd>{data.verifiedChatTitle ?? "—"}</dd></div>
            <div><dt>{copy(locale, "机器人", "Bot")}</dt><dd>{data.botUsername ? `@${data.botUsername}` : "—"}</dd></div>
            <div><dt>{copy(locale, "验证时间", "Verified")}</dt><dd>{data.verifiedAt ? formatDate(data.verifiedAt, locale) : "—"}</dd></div>
          </dl>
        </aside>
      </div>

      <section className="admin-panel telegram-simulation-panel">
        <div className="telegram-panel-heading">
          <div>
            <small>REAL CONNECTION TEST</small>
            <h2>{copy(locale, "发送真实连接测试", "Send a real connection test")}</h2>
            <p>{copy(locale, "消息不会读取订单或客户联系方式；成功后保存群组标题与 Telegram 回执。", "The message uses no order or customer data; success stores the group title and Telegram receipt.")}</p>
          </div>
        </div>
        <div className="telegram-form-actions">
          <input
            aria-label={copy(locale, "测试原因", "Test reason")}
            placeholder={copy(locale, "填写测试原因（至少 8 个字符）", "Test reason (at least 8 characters)")}
            value={testReason}
            onChange={(event) => setTestReason(event.target.value)}
          />
          <button
            className="admin-primary"
            disabled={!canWrite || dirty || testing}
            type="button"
            onClick={() => void testConnection()}
          >
            <PaperPlaneTilt aria-hidden="true" />
            {testing ? copy(locale, "正在发送", "Sending") : copy(locale, "发送真实测试", "Send real test")}
          </button>
        </div>
        {testResult && (
          <p className="admin-success" role="status">
            {copy(locale, "真实消息已送达", "Real message delivered")} · {testResult.chatTitle} · #{testResult.messageId}
          </p>
        )}
      </section>

      <section className="admin-panel telegram-simulation-panel">
        <div className="telegram-panel-heading">
          <div>
            <small>SAFE PREVIEW</small>
            <h2>{copy(locale, "消息预览", "Message preview")}</h2>
          </div>
          <button
            className="admin-secondary"
            disabled={dirty || simulating}
            type="button"
            onClick={() => void simulate()}
          >
            <Eye aria-hidden="true" />
            {simulating ? copy(locale, "正在生成", "Generating") : copy(locale, "生成预览", "Generate preview")}
          </button>
        </div>
        {simulation && (
          <dl className="telegram-simulation-result">
            {simulation.fields.map((field) => (
              <div key={field.code}><dt>{fieldLabels[field.code][locale]}</dt><dd>{field.value}</dd></div>
            ))}
          </dl>
        )}
      </section>

      <section className="admin-panel telegram-delivery-panel">
        <div className="telegram-panel-heading">
          <div>
            <small>DELIVERY OUTBOX</small>
            <h2>{copy(locale, "最近投递记录", "Recent deliveries")}</h2>
          </div>
          <button className="admin-secondary" type="button" onClick={() => void deliveryResource.reload()}>
            <ArrowClockwise aria-hidden="true" />{copy(locale, "刷新", "Refresh")}
          </button>
        </div>
        {!deliveryResource.data ? (
          <PanelState state={deliveryResource.state} locale={locale} retry={() => void deliveryResource.reload()} />
        ) : (
          <div
            aria-label={copy(locale, "Telegram 投递记录表，可横向滚动", "Telegram delivery table, horizontally scrollable")}
            className="admin-table-shell"
            tabIndex={0}
          >
            <table>
              <thead><tr>
                <th>{copy(locale, "订单号", "Order")}</th>
                <th>{copy(locale, "状态", "Status")}</th>
                <th>{copy(locale, "尝试", "Attempts")}</th>
                <th>{copy(locale, "Telegram 消息", "Telegram message")}</th>
                <th>{copy(locale, "更新时间", "Updated")}</th>
                <th>{copy(locale, "操作", "Action")}</th>
              </tr></thead>
              <tbody>
                {deliveryResource.data.length === 0 ? (
                  <tr><td colSpan={6}>{copy(locale, "尚无真实订单投递记录。", "No real order deliveries yet.")}</td></tr>
                ) : deliveryResource.data.map((item) => (
                  <tr key={item.id}>
                    <td>{item.orderNumber}</td>
                    <td><code>{item.status}</code></td>
                    <td>{item.attemptCount}</td>
                    <td>{item.telegramMessageId ?? "—"}</td>
                    <td>{formatDate(item.updatedAt, locale)}</td>
                    <td>
                      <button
                        className="admin-secondary"
                        disabled={!canWrite || item.status !== "FAILED"}
                        type="button"
                        onClick={() => void retry(item)}
                      >{copy(locale, "重试", "Retry")}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
