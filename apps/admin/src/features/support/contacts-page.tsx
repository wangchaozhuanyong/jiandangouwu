import type {
  AdminContactChannel,
  Locale,
  UpdateContactChannelInput,
} from "@cloudbridge/contracts";
import { isConfiguredContactChannel } from "@cloudbridge/contracts";
import {
  ArrowDown,
  ArrowUp,
  ChatsCircle,
  EnvelopeSimple,
  NotePencil,
  QrCode,
  Trash,
  UploadSimple,
  TelegramLogo,
  WarningCircle,
  WhatsappLogo,
} from "@phosphor-icons/react";
import {
  useCallback,
  useEffect,
  useId,
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
  Dialog,
  HelpTip,
  PanelState,
  RefreshNotice,
  useUnsavedChanges,
} from "../../admin-ui";
import { helpTriggerLabel } from "../../help-content";
import {
  getContactChannels,
  removeWechatQr,
  reorderContactChannels,
  updateContactChannel,
  uploadWechatQr,
} from "./api";

const copy = (locale: Locale, zh: string, en: string) => locale === "zh" ? zh : en;
const channelTargetHelp = (
  item: AdminContactChannel,
  account: string,
  locale: Locale,
): string => {
  const publicAccount = account.trim() || copy(locale, "公开账号", "the public account");
  if (item.type === "WHATSAPP") {
    return copy(
      locale,
      "使用 https://wa.me/国家代码和手机号，可在末尾附加预设消息参数。号码不包含加号、空格或短横线。",
      "Use https://wa.me/country-code-and-number. An optional preset-message query may follow. Do not include a plus sign, spaces, or hyphens.",
    );
  }
  if (item.type === "EMAIL") {
    return copy(
      locale,
      "使用 mailto:邮箱地址，例如 mailto:support@example.com。",
      "Use mailto: followed by the address, for example mailto:support@example.com.",
    );
  }
  if (item.type === "TELEGRAM") {
    return copy(
      locale,
      "使用 https://t.me/用户名，用户名至少 5 个字符，只包含字母、数字和下划线。",
      "Use https://t.me/username. The username must contain at least five letters, numbers, or underscores.",
    );
  }
  if (item.type === "WECHAT") {
    return copy(
      locale,
      "微信只提供二维码或复制公开账号，不允许填写网页直跳地址。",
      "WeChat uses QR or public-account copy only and does not accept a web direct target.",
    );
  }
  return copy(
    locale,
    `使用 mqqwpa://im/chat?chat_type=wpa&uin=${publicAccount}。uin 必须是 5–15 位数字，并与公开账号完全一致。`,
    `Use mqqwpa://im/chat?chat_type=wpa&uin=${publicAccount}. The uin must contain 5–15 digits and exactly match the public account.`,
  );
};
const channelIcons = {
  WHATSAPP: WhatsappLogo,
  EMAIL: EnvelopeSimple,
  TELEGRAM: TelegramLogo,
  WECHAT: QrCode,
  QQ: ChatsCircle,
} satisfies Record<AdminContactChannel["type"], typeof ChatsCircle>;

export default function ContactsPage({ canWrite, locale }: { canWrite: boolean; locale: Locale }) {
  const loader = useCallback((signal: AbortSignal) => getContactChannels(signal), []);
  const { commit, data, state, reload } = useCachedAdminResource<AdminContactChannel[]>("contact-channels", loader);
  const slow = useSlowAdminRequest(state);
  const { notify } = useAdminStatus();
  const [ordered, setOrdered] = useState<AdminContactChannel[]>(() => data ?? []);
  const [editing, setEditing] = useState<AdminContactChannel | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderError, setOrderError] = useState("");

  useEffect(() => {
    if (data) setOrdered(data);
  }, [data]);

  const orderDirty = Boolean(data) && ordered.map((item) => item.id).join("|")
    !== data?.map((item) => item.id).join("|");
  useUnsavedChanges(orderDirty);
  useAdminPageDirty(orderDirty);

  const move = (index: number, offset: -1 | 1) => {
    const target = index + offset;
    if (target < 0 || target >= ordered.length) return;
    setOrdered((current) => {
      const next = [...current];
      const [item] = next.splice(index, 1);
      if (item) next.splice(target, 0, item);
      return next;
    });
    setOrderError("");
  };

  const saveOrder = async () => {
    if (!canWrite || !orderDirty || savingOrder) return;
    setSavingOrder(true);
    setOrderError("");
    try {
      const response = await reorderContactChannels({
        items: ordered.map((item) => ({ id: item.id, version: item.version })),
      });
      commit(response.data);
      setOrdered(response.data);
      notify(copy(locale, "联系方式顺序已保存。", "Contact order saved."));
      void reload();
    } catch (error) {
      const message = error instanceof ApiError && error.status === 409
        ? copy(locale, "联系方式已被其他管理员修改，请重新加载。", "Contact channels changed. Reload and try again.")
        : error instanceof ApiError && error.status === 403
          ? copy(locale, "当前账号没有调整联系方式顺序的权限。", "This account cannot reorder contact channels.")
          : copy(locale, "联系方式顺序未保存。", "Contact order was not saved.");
      setOrderError(message);
      notify(message, "error");
    } finally {
      setSavingOrder(false);
    }
  };

  if (!data) {
    return (
      <section className="admin-panel">
        <PanelState state={state} locale={locale} retry={() => void reload()} kind="cards" />
      </section>
    );
  }

  return (
    <>
      <div className="real-page-toolbar">
        <span>
          {copy(
            locale,
            `${ordered.length} 个渠道 · ${ordered.filter((item) => item.active).length} 个已启用`,
            `${ordered.length} channels · ${ordered.filter((item) => item.active).length} active`,
          )}
        </span>
        {canWrite && (
          <div>
            {orderDirty && (
              <button className="admin-secondary" disabled={savingOrder} onClick={() => setOrdered(data)}>
                {copy(locale, "撤销排序", "Reset order")}
              </button>
            )}
            <button className="admin-secondary" disabled={!orderDirty || savingOrder} onClick={() => void saveOrder()}>
              {savingOrder ? copy(locale, "正在保存", "Saving") : copy(locale, "保存排序", "Save order")}
            </button>
          </div>
        )}
      </div>
      <RefreshNotice state={state} locale={locale} retry={() => void reload()} slow={slow} />
      {orderError && <p className="form-error real-page-error" role="alert"><WarningCircle />{orderError}</p>}
      {ordered.length === 0 ? (
        <section className="admin-panel">
          <PanelState state="empty" locale={locale} retry={() => void reload()} kind="cards" />
        </section>
      ) : (
        <div className="design-channel-grid real-channel-grid">
          {ordered.map((channel, index) => {
            const Icon = channelIcons[channel.type];
            return (
              <article className="admin-panel" key={channel.id}>
                <span className="design-channel-icon"><Icon size={24} /></span>
                <div>
                  <small>{index === 0 ? copy(locale, "首选联系方式", "Primary channel") : channel.type}</small>
                  <h2>{channel.label[locale]}</h2>
                  <p>{channel.publicAccount}</p>
                </div>
                <span className={`channel-live-state${channel.active ? " is-active" : ""}`}>
                  {channel.active ? copy(locale, "已启用", "Active") : copy(locale, "已停用", "Inactive")}
                </span>
                <dl>
                  <div><dt>{copy(locale, "服务时间", "Service hours")}</dt><dd>{channel.serviceHours[locale]}</dd></div>
                  <div><dt>{copy(locale, "渠道模式", "Channel mode")}</dt><dd>{channel.mode}</dd></div>
                  {channel.type === "WECHAT" && (
                    <div>
                      <dt>{copy(locale, "微信二维码", "WeChat QR")}</dt>
                      <dd>{channel.qrImageUrl ? copy(locale, "已上传", "Uploaded") : copy(locale, "未上传（仍可复制微信号）", "Not uploaded (account copy remains available)")}</dd>
                    </div>
                  )}
                </dl>
                {canWrite && (
                  <div className="real-card-actions">
                    <button
                      aria-label={copy(locale, `向前移动 ${channel.label.zh}`, `Move ${channel.label.en} earlier`)}
                      disabled={index === 0 || savingOrder}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      aria-label={copy(locale, `向后移动 ${channel.label.zh}`, `Move ${channel.label.en} later`)}
                      disabled={index === ordered.length - 1 || savingOrder}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown size={16} />
                    </button>
                    <button
                      aria-label={copy(locale, `编辑 ${channel.label.zh}`, `Edit ${channel.label.en}`)}
                      disabled={orderDirty}
                      title={orderDirty ? copy(locale, "请先保存或撤销当前排序", "Save or reset the current order first") : undefined}
                      onClick={() => setEditing(channel)}
                    >
                      <NotePencil size={16} />{copy(locale, "编辑", "Edit")}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
      {editing && (
        <ContactChannelDialog
          item={editing}
          locale={locale}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null);
            const next = itemAfterSave(data, saved);
            commit(next);
            setOrdered(next);
            void reload();
          }}
        />
      )}
    </>
  );
}

function itemAfterSave(current: AdminContactChannel[], saved: AdminContactChannel): AdminContactChannel[] {
  return current
    .map((item) => item.id === saved.id ? saved : item)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
}

function ContactChannelDialog({
  item,
  locale,
  onClose,
  onSaved,
}: {
  item: AdminContactChannel;
  locale: Locale;
  onClose: () => void;
  onSaved: (saved: AdminContactChannel) => void;
}) {
  const { notify } = useAdminStatus();
  const initialForm = useMemo<UpdateContactChannelInput>(() => ({
    version: item.version,
    label: item.label,
    publicAccount: item.publicAccount,
    directTarget: item.directTarget,
    serviceHours: item.serviceHours,
    active: item.active,
    sortOrder: item.sortOrder,
  }), [item]);
  const [form, setForm] = useState(initialForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [targetError, setTargetError] = useState("");
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrReason, setQrReason] = useState("");
  const [qrScanned, setQrScanned] = useState(false);
  const [qrBusy, setQrBusy] = useState(false);
  const [qrError, setQrError] = useState("");
  const [qrPreviewUrl, setQrPreviewUrl] = useState("");
  const targetErrorId = useId();
  const dirty = JSON.stringify(form) !== JSON.stringify(initialForm);
  const qrDirty = Boolean(qrFile) || Boolean(qrReason.trim()) || qrScanned;
  useUnsavedChanges(dirty || qrDirty);
  useAdminPageDirty(dirty || qrDirty);

  useEffect(() => {
    if (!qrFile) {
      setQrPreviewUrl("");
      return undefined;
    }
    const url = URL.createObjectURL(qrFile);
    setQrPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [qrFile]);

  const requestClose = useCallback(() => {
    if ((dirty || qrDirty) && !window.confirm(copy(locale, "尚有未保存内容，确定关闭吗？", "Discard unsaved changes?"))) return;
    onClose();
  }, [dirty, locale, onClose, qrDirty]);

  const saveQr = async () => {
    if (!qrFile || qrBusy || dirty) return;
    const reason = qrReason.trim();
    if (qrFile.size < 1 || qrFile.size > 5_000_000) {
      setQrError(copy(locale, "二维码图片必须小于 5MB。", "The QR image must be smaller than 5 MB."));
      return;
    }
    if (reason.length < 8 || reason.length > 500) {
      setQrError(copy(locale, "请填写至少 8 个字符的上传原因。", "Enter an upload reason of at least 8 characters."));
      return;
    }
    if (!qrScanned) {
      setQrError(copy(locale, "请先用真实微信扫码确认这张图片可用。", "Scan the image with WeChat and confirm it works first."));
      return;
    }
    setQrBusy(true);
    setQrError("");
    try {
      const saved = (await uploadWechatQr(item.id, qrFile, item.version, reason)).data;
      notify(copy(locale, "微信二维码已上传并记录审计。", "WeChat QR uploaded and audited."));
      onSaved(saved);
    } catch (requestError) {
      const message = requestError instanceof ApiError && requestError.status === 409
        ? copy(locale, "渠道已被其他管理员修改，请重新加载后再上传。", "The channel changed elsewhere. Reload before uploading.")
        : requestError instanceof ApiError && requestError.status === 413
          ? copy(locale, "二维码图片超过 5MB。", "The QR image exceeds 5 MB.")
          : requestError instanceof ApiError && requestError.code === "MEDIA_FILE_TYPE_INVALID"
            ? copy(locale, "文件内容不是有效的 PNG、JPEG 或 WebP 图片。", "The file is not a genuine PNG, JPEG, or WebP image.")
            : copy(locale, "二维码未上传，请检查文件和业务原因。", "The QR image was not uploaded. Check the file and reason.");
      setQrError(message);
      notify(message, "error");
    } finally {
      setQrBusy(false);
    }
  };

  const removeQr = async () => {
    if (!item.qrImageUrl || qrBusy || dirty) return;
    const reason = qrReason.trim();
    if (reason.length < 8 || reason.length > 500) {
      setQrError(copy(locale, "请填写至少 8 个字符的移除原因。", "Enter a removal reason of at least 8 characters."));
      return;
    }
    if (!window.confirm(copy(
      locale,
      "移除后客户端不再显示二维码，但仍可复制微信号。R2 文件会保留在媒体库中。",
      "The storefront will stop showing the QR image but account copy remains available. The R2 file stays in the media library.",
    ))) return;
    setQrBusy(true);
    setQrError("");
    try {
      const saved = (await removeWechatQr(item.id, item.version, reason)).data;
      notify(copy(locale, "微信二维码引用已移除。", "WeChat QR reference removed."));
      onSaved(saved);
    } catch (requestError) {
      const message = requestError instanceof ApiError && requestError.status === 409
        ? copy(locale, "渠道已被其他管理员修改，请重新加载后再移除。", "The channel changed elsewhere. Reload before removing.")
        : copy(locale, "二维码引用未移除。", "The QR reference was not removed.");
      setQrError(message);
      notify(message, "error");
    } finally {
      setQrBusy(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const normalized: UpdateContactChannelInput = {
      ...form,
      label: {
        zh: form.label.zh.trim(),
        en: form.label.en.trim(),
      },
      publicAccount: form.publicAccount.trim(),
      directTarget: form.directTarget?.trim() || null,
      serviceHours: {
        zh: form.serviceHours.zh.trim(),
        en: form.serviceHours.en.trim(),
      },
    };
    setTargetError("");
    if (!normalized.label.zh
      || !normalized.label.en
      || !normalized.publicAccount
      || !normalized.serviceHours.zh
      || !normalized.serviceHours.en) {
      setError(copy(locale, "名称、公开账号和服务时间不能只包含空格。", "Labels, public account, and service hours cannot be blank."));
      return;
    }
    if (normalized.active && !isConfiguredContactChannel({
      type: item.type,
      mode: item.mode,
      publicAccount: normalized.publicAccount,
      directTarget: normalized.directTarget,
    })) {
      setError("");
      setTargetError(item.type === "QQ"
        ? copy(
            locale,
            "QQ 跳转地址必须使用 mqqwpa:// 协议，并且 uin 与公开账号一致。",
            "The QQ target must use mqqwpa:// and its uin must match the public account.",
          )
        : copy(
            locale,
            "启用前必须填写该渠道允许的安全跳转地址。",
            "Add an approved target for this channel before activation.",
          ));
      return;
    }
    if (item.active && !normalized.active && !window.confirm(copy(
      locale,
      `停用 ${item.label.zh} 后，客户端将不再显示这个渠道。确定继续吗？`,
      `Disabling ${item.label.en} removes it from the storefront. Continue?`,
    ))) return;
    setBusy(true);
    setError("");
    setTargetError("");
    try {
      const saved = (await updateContactChannel(item.id, normalized)).data;
      notify(copy(locale, "联系方式已保存。", "Contact channel saved."));
      onSaved(saved);
    } catch (requestError) {
      const notConfigured = requestError instanceof ApiError
        && requestError.code === "CONTACT_CHANNEL_NOT_CONFIGURED";
      const message = requestError instanceof ApiError && requestError.code === "CONTACT_CHANNEL_REQUIRED"
        ? copy(
            locale,
            "这是当前最后一个可用渠道。请先在网站设置中关闭接单和客服入口。",
            "This is the final usable channel. Disable new orders and support access in Site settings first.",
          )
        : notConfigured
          ? copy(
              locale,
              "启用前必须填写真实公开账号和该渠道允许的安全跳转地址。",
              "Add a real public account and approved channel target before activation.",
            )
          : requestError instanceof ApiError && requestError.status === 409
        ? copy(locale, "渠道已被其他管理员修改，请关闭后重新加载。", "This channel changed elsewhere. Close and reload.")
        : requestError instanceof ApiError && requestError.status === 403
          ? copy(locale, "当前账号没有编辑联系方式的权限。", "This account cannot edit contact channels.")
          : copy(locale, "联系方式未保存，请检查账号和跳转地址。", "Contact channel was not saved. Check the account and target.");
      if (notConfigured) {
        setTargetError(message);
        setError("");
      } else {
        setError(message);
      }
      notify(message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={copy(locale, `编辑 ${item.label.zh}`, `Edit ${item.label.en}`)}
      closeLabel={copy(locale, "关闭", "Close")}
      help={copy(
        locale,
        "渠道类型和模式由系统规则固定。这里只能维护名称、公开账号、允许的安全跳转地址、服务时间和客户端启用状态。",
        "Channel type and mode are fixed by system rules. This dialog changes labels, the public account, the approved target, service hours, and storefront activation.",
      )}
      helpLabel={helpTriggerLabel(locale, copy(locale, `编辑 ${item.label.zh}`, `Edit ${item.label.en}`))}
      onClose={requestClose}
      wide
    >
      <form className="editor-form" onSubmit={submit}>
        <div className="channel-identity-note">
          <strong>{item.type}</strong>
          <span>{item.mode}</span>
        </div>
        <div className="form-grid two">
          <label><span>{copy(locale, "中文名称", "Chinese label")}</span><input value={form.label.zh} onChange={(event) => setForm({ ...form, label: { ...form.label, zh: event.target.value } })} maxLength={120} required /></label>
          <label><span>{copy(locale, "英文名称", "English label")}</span><input value={form.label.en} onChange={(event) => setForm({ ...form, label: { ...form.label, en: event.target.value } })} maxLength={120} required /></label>
        </div>
        <label>
          <span>{copy(locale, "公开账号", "Public account")}</span>
          <input
            value={form.publicAccount}
            onChange={(event) => {
              setForm({ ...form, publicAccount: event.target.value });
              setTargetError("");
            }}
            maxLength={240}
            required
          />
        </label>
        {item.type === "WECHAT" && (
          <section className="wechat-qr-editor" aria-labelledby="wechat-qr-title">
            <div className="wechat-qr-editor-heading">
              <div>
                <strong id="wechat-qr-title">{copy(locale, "微信二维码", "WeChat QR image")}</strong>
                <small>{copy(locale, "真实图片会写入 Sites R2；系统不会宣称已扫码验证。", "The genuine image is stored in Sites R2; the system never claims it was scan-verified.")}</small>
              </div>
              {(qrPreviewUrl || item.qrImageUrl) && (
                <img alt={copy(locale, "待确认的微信二维码预览", "WeChat QR preview pending confirmation")} src={qrPreviewUrl || item.qrImageUrl || ""} />
              )}
            </div>
            <label>
              <span>{item.qrImageUrl ? copy(locale, "替换二维码图片", "Replace QR image") : copy(locale, "上传二维码图片", "Upload QR image")}</span>
              <input
                accept="image/png,image/jpeg,image/webp"
                disabled={qrBusy || dirty}
                onChange={(event) => {
                  setQrFile(event.target.files?.[0] ?? null);
                  setQrScanned(false);
                  setQrError("");
                }}
                type="file"
              />
            </label>
            <label>
              <span>{copy(locale, "二维码操作原因（至少 8 个字符）", "QR change reason (at least 8 characters)")}</span>
              <textarea
                disabled={qrBusy || dirty}
                maxLength={500}
                minLength={8}
                onChange={(event) => {
                  setQrReason(event.target.value);
                  setQrError("");
                }}
                rows={2}
                value={qrReason}
              />
            </label>
            {qrFile && (
              <label className="checkbox-field">
                <input
                  checked={qrScanned}
                  disabled={qrBusy || dirty}
                  onChange={(event) => setQrScanned(event.target.checked)}
                  type="checkbox"
                />
                <span>{copy(locale, "我已用真实微信扫码确认该二维码可用", "I scanned this QR with WeChat and confirmed it works")}</span>
              </label>
            )}
            {dirty && (
              <small className="field-note">{copy(locale, "请先保存或撤销上方渠道资料修改，再操作二维码。", "Save or discard the channel fields above before changing the QR image.")}</small>
            )}
            {qrError && <p className="form-error" role="alert"><WarningCircle />{qrError}</p>}
            <div className="wechat-qr-actions">
              <button
                className="admin-secondary"
                disabled={!qrFile || !qrScanned || qrBusy || dirty}
                onClick={() => void saveQr()}
                type="button"
              >
                <UploadSimple size={17} />{qrBusy ? copy(locale, "正在处理", "Working") : copy(locale, "上传并应用", "Upload and apply")}
              </button>
              {item.qrImageUrl && (
                <button
                  className="admin-danger"
                  disabled={qrBusy || dirty}
                  onClick={() => void removeQr()}
                  type="button"
                >
                  <Trash size={17} />{copy(locale, "移除二维码", "Remove QR")}
                </button>
              )}
            </div>
          </section>
        )}
        <label>
          <span className="admin-field-title">
            {copy(locale, "安全跳转地址", "Approved direct target")}
            <HelpTip label={helpTriggerLabel(locale, copy(locale, "安全跳转地址", "Approved direct target"))}>
              {channelTargetHelp(item, form.publicAccount, locale)}
            </HelpTip>
          </span>
          <input
            aria-describedby={targetError ? targetErrorId : undefined}
            aria-invalid={Boolean(targetError)}
            value={form.directTarget ?? ""}
            onChange={(event) => {
              setForm({ ...form, directTarget: event.target.value || null });
              setTargetError("");
            }}
            disabled={item.type === "WECHAT"}
            placeholder={item.type === "WECHAT" ? copy(locale, "微信只提供二维码或复制", "WeChat uses QR or copy only") : ""}
            maxLength={512}
          />
          {targetError && <small className="field-error" id={targetErrorId} role="alert">{targetError}</small>}
        </label>
        <div className="form-grid two">
          <label><span>{copy(locale, "中文服务时间", "Chinese service hours")}</span><input value={form.serviceHours.zh} onChange={(event) => setForm({ ...form, serviceHours: { ...form.serviceHours, zh: event.target.value } })} maxLength={120} required /></label>
          <label><span>{copy(locale, "英文服务时间", "English service hours")}</span><input value={form.serviceHours.en} onChange={(event) => setForm({ ...form, serviceHours: { ...form.serviceHours, en: event.target.value } })} maxLength={120} required /></label>
        </div>
        <label className="checkbox-field"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /><span>{copy(locale, "在客户端启用", "Active on storefront")}</span></label>
        {error && <p className="form-error" role="alert"><WarningCircle />{error}</p>}
        <div className="dialog-actions">
          <button type="button" onClick={requestClose}>{copy(locale, "取消", "Cancel")}</button>
          <button className="admin-primary" disabled={busy || !dirty || qrDirty}>{busy ? copy(locale, "正在保存", "Saving") : copy(locale, "保存", "Save")}</button>
        </div>
      </form>
    </Dialog>
  );
}
