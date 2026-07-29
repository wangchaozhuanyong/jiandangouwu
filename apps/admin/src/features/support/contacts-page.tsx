import type {
  AdminContactChannel,
  Locale,
  UpdateContactChannelInput,
} from "@cloudbridge/contracts";
import {
  ArrowDown,
  ArrowUp,
  ChatsCircle,
  EnvelopeSimple,
  NotePencil,
  QrCode,
  TelegramLogo,
  WarningCircle,
  WhatsappLogo,
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
  Dialog,
  PanelState,
  RefreshNotice,
  useUnsavedChanges,
} from "../../admin-ui";
import {
  getContactChannels,
  reorderContactChannels,
  updateContactChannel,
} from "./api";

const copy = (locale: Locale, zh: string, en: string) => locale === "zh" ? zh : en;
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
  const dirty = JSON.stringify(form) !== JSON.stringify(initialForm);
  useUnsavedChanges(dirty);
  useAdminPageDirty(dirty);

  const requestClose = useCallback(() => {
    if (dirty && !window.confirm(copy(locale, "尚有未保存内容，确定关闭吗？", "Discard unsaved changes?"))) return;
    onClose();
  }, [dirty, locale, onClose]);

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
    if (!normalized.label.zh
      || !normalized.label.en
      || !normalized.publicAccount
      || !normalized.serviceHours.zh
      || !normalized.serviceHours.en) {
      setError(copy(locale, "名称、公开账号和服务时间不能只包含空格。", "Labels, public account, and service hours cannot be blank."));
      return;
    }
    if (item.active && !normalized.active && !window.confirm(copy(
      locale,
      `停用 ${item.label.zh} 后，客户端将不再显示这个渠道。确定继续吗？`,
      `Disabling ${item.label.en} removes it from the storefront. Continue?`,
    ))) return;
    setBusy(true);
    setError("");
    try {
      const saved = (await updateContactChannel(item.id, normalized)).data;
      notify(copy(locale, "联系方式已保存。", "Contact channel saved."));
      onSaved(saved);
    } catch (requestError) {
      const message = requestError instanceof ApiError && requestError.status === 409
        ? copy(locale, "渠道已被其他管理员修改，请关闭后重新加载。", "This channel changed elsewhere. Close and reload.")
        : requestError instanceof ApiError && requestError.status === 403
          ? copy(locale, "当前账号没有编辑联系方式的权限。", "This account cannot edit contact channels.")
          : copy(locale, "联系方式未保存，请检查账号和跳转地址。", "Contact channel was not saved. Check the account and target.");
      setError(message);
      notify(message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={copy(locale, `编辑 ${item.label.zh}`, `Edit ${item.label.en}`)}
      closeLabel={copy(locale, "关闭", "Close")}
      onClose={requestClose}
      wide
    >
      <form className="editor-form" onSubmit={submit}>
        <div className="channel-identity-note">
          <strong>{item.type}</strong>
          <span>{item.mode}</span>
          <small>{copy(locale, "渠道类型和模式由系统规则固定，不能在这里改成其他协议。", "Channel type and mode are fixed by system rules.")}</small>
        </div>
        <div className="form-grid two">
          <label><span>{copy(locale, "中文名称", "Chinese label")}</span><input value={form.label.zh} onChange={(event) => setForm({ ...form, label: { ...form.label, zh: event.target.value } })} maxLength={120} required /></label>
          <label><span>{copy(locale, "英文名称", "English label")}</span><input value={form.label.en} onChange={(event) => setForm({ ...form, label: { ...form.label, en: event.target.value } })} maxLength={120} required /></label>
        </div>
        <label><span>{copy(locale, "公开账号", "Public account")}</span><input value={form.publicAccount} onChange={(event) => setForm({ ...form, publicAccount: event.target.value })} maxLength={240} required /></label>
        <label>
          <span>{copy(locale, "安全跳转地址", "Approved direct target")}</span>
          <input
            value={form.directTarget ?? ""}
            onChange={(event) => setForm({ ...form, directTarget: event.target.value || null })}
            disabled={item.type === "WECHAT"}
            placeholder={item.type === "WECHAT" ? copy(locale, "微信只提供二维码或复制", "WeChat uses QR or copy only") : ""}
            maxLength={512}
          />
        </label>
        <div className="form-grid two">
          <label><span>{copy(locale, "中文服务时间", "Chinese service hours")}</span><input value={form.serviceHours.zh} onChange={(event) => setForm({ ...form, serviceHours: { ...form.serviceHours, zh: event.target.value } })} maxLength={120} required /></label>
          <label><span>{copy(locale, "英文服务时间", "English service hours")}</span><input value={form.serviceHours.en} onChange={(event) => setForm({ ...form, serviceHours: { ...form.serviceHours, en: event.target.value } })} maxLength={120} required /></label>
        </div>
        <label className="checkbox-field"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /><span>{copy(locale, "在客户端启用", "Active on storefront")}</span></label>
        {error && <p className="form-error" role="alert"><WarningCircle />{error}</p>}
        <div className="dialog-actions">
          <button type="button" onClick={requestClose}>{copy(locale, "取消", "Cancel")}</button>
          <button className="admin-primary" disabled={busy || !dirty}>{busy ? copy(locale, "正在保存", "Saving") : copy(locale, "保存", "Save")}</button>
        </div>
      </form>
    </Dialog>
  );
}
