"use client";

import {
  ArrowSquareOut,
  CaretDown,
  Check,
  ChatsCircle,
  Copy,
  DownloadSimple,
  EnvelopeSimple,
  Headset,
  QrCode,
  TelegramLogo,
  WarningCircle,
  WechatLogo,
  WhatsappLogo,
  X,
} from "@phosphor-icons/react";
import type { Locale } from "@cloudbridge/contracts";
import {
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  getConfig,
  type StorefrontChannel,
  type StorefrontConfig,
  type StorefrontCurrency,
} from "../lib/api";
import { resolveContactTarget } from "../lib/contact-actions";
import { copy } from "../lib/copy";

type LanguagePickerProps = {
  ariaLabel: string;
  onChange: (locale: Locale) => void;
  value: Locale;
};

export function LanguagePicker({
  ariaLabel,
  onChange,
  value,
}: LanguagePickerProps) {
  const nextLocale: Locale = value === "zh" ? "en" : "zh";
  const visibleLabel = value === "zh" ? "中" : "EN";
  const actionLabel = value === "zh"
    ? `${ariaLabel}：English`
    : `${ariaLabel}: 中文`;

  return (
    <button
      aria-label={actionLabel}
      className="language-picker"
      lang={value === "zh" ? "zh-CN" : "en"}
      onClick={() => onChange(nextLocale)}
      title={actionLabel}
      type="button"
    >
      <strong aria-hidden="true">{visibleLabel}</strong>
    </button>
  );
}

type CurrencyPickerProps = {
  ariaLabel: string;
  currencies: StorefrontCurrency[];
  onChange: (currency: string) => void;
  value: string;
  variant?: "catalog" | "compact";
};

export function CurrencyPicker({
  ariaLabel,
  currencies,
  onChange,
  value,
  variant = "catalog",
}: CurrencyPickerProps) {
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selectedIndex = Math.max(0, currencies.findIndex((item) => item.code === value));
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const activeCurrency = currencies[selectedIndex];

  const focusOption = (index: number) => {
    if (!currencies.length) return;
    const nextIndex = (index + currencies.length) % currencies.length;
    setActiveIndex(nextIndex);
    window.requestAnimationFrame(() => optionRefs.current[nextIndex]?.focus());
  };

  const openMenu = (index = selectedIndex) => {
    if (!currencies.length) return;
    setOpen(true);
    focusOption(index);
  };

  const closeMenu = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) closeMenu();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const selectCurrency = (currency: StorefrontCurrency) => {
    onChange(currency.code);
    closeMenu(true);
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openMenu(event.key === "ArrowDown" ? selectedIndex : selectedIndex - 1);
    }
  };

  const handleOptionKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
    currency: StorefrontCurrency,
  ) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      focusOption(index + (event.key === "ArrowDown" ? 1 : -1));
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      focusOption(event.key === "Home" ? 0 : currencies.length - 1);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectCurrency(currency);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
      return;
    }
    if (event.key === "Tab") closeMenu();
  };

  return (
    <div className={`currency-picker currency-picker--${variant}`} ref={rootRef}>
      <button
        aria-controls={menuId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className="currency-picker__trigger"
        disabled={!currencies.length}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={handleTriggerKeyDown}
        ref={triggerRef}
        role="combobox"
        type="button"
      >
        <b>{activeCurrency?.token ?? "—"}</b>
        <span>
          <strong>{activeCurrency?.name ?? ariaLabel}</strong>
        </span>
        <CaretDown aria-hidden="true" size={15} />
      </button>
      {open && (
        <div
          aria-label={ariaLabel}
          className="currency-picker__menu"
          id={menuId}
          role="listbox"
        >
          {currencies.map((currency, index) => (
            <button
              aria-selected={currency.code === value}
              className={currency.code === value ? "is-selected" : ""}
              key={currency.code}
              onClick={() => selectCurrency(currency)}
              onFocus={() => setActiveIndex(index)}
              onKeyDown={(event) => handleOptionKeyDown(event, index, currency)}
              ref={(node) => {
                optionRefs.current[index] = node;
              }}
              role="option"
              tabIndex={activeIndex === index ? 0 : -1}
              type="button"
            >
              <b>{currency.token}</b>
              <span><strong>{currency.name}</strong></span>
              {currency.code === value && <Check aria-hidden="true" size={17} weight="bold" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type SupportDrawerProps = {
  initialConfig: StorefrontConfig | null;
  locale: Locale;
  onClose: () => void;
  open: boolean;
};

const channelIcons = {
  WHATSAPP: WhatsappLogo,
  EMAIL: EnvelopeSimple,
  TELEGRAM: TelegramLogo,
  WECHAT: WechatLogo,
  QQ: ChatsCircle,
} satisfies Record<StorefrontChannel["type"], typeof ChatsCircle>;

export function SupportDrawer({ initialConfig, locale, onClose, open }: SupportDrawerProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const qrChannelRef = useRef<StorefrontChannel | null>(null);
  const [config, setConfig] = useState<StorefrontConfig | null>(initialConfig);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">(initialConfig ? "ready" : "idle");
  const [copied, setCopied] = useState("");
  const [copyError, setCopyError] = useState(false);
  const [qqFallbackVisible, setQqFallbackVisible] = useState(false);
  const [qrChannel, setQrChannel] = useState<StorefrontChannel | null>(null);
  const [qrStatus, setQrStatus] = useState("");
  const [qrBusy, setQrBusy] = useState(false);
  const t = copy[locale];
  const zh = locale === "zh";
  const supportAvailable = config?.settings.supportEnabled === true
    && config.channels.length > 0;
  qrChannelRef.current = qrChannel;

  const loadChannels = async () => {
    setState("loading");
    try {
      const nextConfig = await getConfig(locale);
      setConfig(nextConfig);
      setState("ready");
    } catch {
      setState("error");
    }
  };

  useEffect(() => {
    setConfig(initialConfig);
    setState(initialConfig ? "ready" : "idle");
    setQqFallbackVisible(false);
  }, [initialConfig, locale]);

  useEffect(() => {
    if (!open || state !== "idle") return;
    void loadChannels();
  }, [open, state]);

  useEffect(() => {
    if (!open) setQqFallbackVisible(false);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => closeRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (qrChannelRef.current) {
          setQrChannel(null);
          setQrStatus("");
          return;
        }
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...(panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [])];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus();
    };
  }, [onClose, open]);

  const copyAccount = async (channel: StorefrontChannel) => {
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(channel.account);
      setCopied(channel.type);
      if (channel.type === "QQ") setQqFallbackVisible(false);
      window.setTimeout(() => setCopied(""), 1600);
    } catch {
      setCopyError(true);
    }
  };

  const handleQqLaunch = () => {
    setCopyError(false);
    setQqFallbackVisible(true);
  };

  const openQr = (channel: StorefrontChannel) => {
    setQrChannel(channel);
    setQrStatus("");
  };

  const saveQr = async (channel: StorefrontChannel) => {
    if (!channel.qrImageUrl || qrBusy) return;
    setQrBusy(true);
    setQrStatus("");
    try {
      const response = await fetch(channel.qrImageUrl, { credentials: "same-origin" });
      if (!response.ok) throw new Error("QR fetch failed");
      const blob = await response.blob();
      const extension = blob.type === "image/png"
        ? "png"
        : blob.type === "image/webp"
          ? "webp"
          : "jpg";
      const file = new File([blob], `cloudbridge-wechat-qr.${extension}`, { type: blob.type });
      const shareData = { files: [file], title: channel.label };
      if (
        typeof navigator.share === "function"
        && typeof navigator.canShare === "function"
        && navigator.canShare(shareData)
      ) {
        await navigator.share(shareData);
        setQrStatus(zh ? "已打开系统分享或保存选项。" : "System share or save options opened.");
        return;
      }
      const anchor = document.createElement("a");
      anchor.href = channel.qrImageUrl;
      anchor.download = file.name;
      anchor.rel = "noreferrer";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setQrStatus(zh
        ? "已请求下载原图；如浏览器只打开图片，请长按图片保存到相册。"
        : "Original-image download requested. If the browser opens it instead, press and hold the image to save it.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setQrStatus(zh
        ? "没有打开保存选项，请长按原图保存，或使用下方下载按钮。"
        : "Save options did not open. Press and hold the original image, or use the download button below.");
    } finally {
      setQrBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="support-drawer-layer"
      onPointerDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <aside
        aria-labelledby={titleId}
        aria-modal="true"
        className="support-drawer"
        ref={panelRef}
        role="dialog"
      >
        <header>
          <div>
            <span><Headset aria-hidden="true" size={18} /></span>
            <div>
              <p>{zh ? "人工服务" : "Human support"}</p>
              <h2 id={titleId}>{zh ? "联系客服" : "Contact support"}</h2>
            </div>
          </div>
          <button aria-label={zh ? "关闭客服面板" : "Close support panel"} onClick={onClose} ref={closeRef} type="button">
            <X aria-hidden="true" size={19} />
          </button>
        </header>
        <p className="support-drawer__lead">
          {zh
            ? "选择一种方便的方式与人工客服继续沟通。账号和服务时间由管理后台统一配置。"
            : "Choose one convenient way to continue with human support. Accounts and service hours come from the admin configuration."}
        </p>

        {state === "loading" && (
          <div aria-label={zh ? "正在加载客服渠道" : "Loading support channels"} className="support-drawer__loading">
            {Array.from({ length: 3 }, (_, index) => <span key={index} />)}
          </div>
        )}
        {state === "error" && (
          <div className="support-drawer__error" role="alert">
            <WarningCircle aria-hidden="true" size={24} />
            <strong>{zh ? "暂时无法读取客服渠道" : "Support channels are unavailable"}</strong>
            <p>{zh ? "请检查网络后重新加载。" : "Check your connection and try again."}</p>
            <button onClick={() => void loadChannels()} type="button">{zh ? "重新加载" : "Reload"}</button>
          </div>
        )}
        {state === "ready" && !supportAvailable && (
          <div className="support-drawer__error" role="status">
            <Headset aria-hidden="true" size={24} />
            <strong>{t.supportUnavailableTitle}</strong>
            <p>{t.supportUnavailableBody}</p>
          </div>
        )}
        {state === "ready" && supportAvailable && (
          <div className="support-channel-list">
            {config?.channels.map((channel) => {
              const Icon = channelIcons[channel.type];
              const directTarget = resolveContactTarget(channel, locale);
              const external = Boolean(directTarget?.startsWith("http"));
              return (
                <article key={channel.type}>
                  <div className="support-channel__identity">
                    <span><Icon aria-hidden="true" size={23} /></span>
                    <div>
                      <strong>{channel.label}</strong>
                      <small>{channel.account}</small>
                    </div>
                    <em>{channel.serviceHours}</em>
                  </div>
                  {channel.type === "WECHAT" && channel.qrImageUrl && (
                    <button
                      className="support-channel__qr-preview"
                      onClick={() => openQr(channel)}
                      type="button"
                    >
                      <img alt="" src={channel.qrImageUrl} />
                      <span>
                        <strong>{zh ? "查看微信二维码" : "View WeChat QR"}</strong>
                        <small>{zh ? "可打开原图并使用手机保存选项" : "Open the original and use mobile save options"}</small>
                      </span>
                      <QrCode aria-hidden="true" size={20} />
                    </button>
                  )}
                  <div className="support-channel__actions">
                    {directTarget && (
                      <a
                        href={directTarget}
                        onClick={channel.type === "QQ" ? handleQqLaunch : undefined}
                        rel={external ? "noreferrer" : undefined}
                        target={external ? "_blank" : undefined}
                      >
                        <ArrowSquareOut aria-hidden="true" size={16} />
                        {channel.type === "WHATSAPP"
                          ? (zh ? "打开 WhatsApp" : "Open WhatsApp")
                          : channel.type === "EMAIL"
                            ? (zh ? "撰写邮件" : "Write email")
                            : channel.type === "TELEGRAM"
                              ? (zh ? "打开 Telegram" : "Open Telegram")
                              : (zh ? "尝试打开 QQ" : "Try to open QQ")}
                      </a>
                    )}
                    <button onClick={() => void copyAccount(channel)} type="button">
                      {copied === channel.type ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />}
                      {copied === channel.type ? (zh ? "已复制" : "Copied") : (zh ? "复制账号" : "Copy account")}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <div aria-live="polite" className="support-drawer__status" role="status">
          {copyError
            ? (zh ? "复制失败，请手动选择上方账号。" : "Copy failed. Select the account above manually.")
            : qqFallbackVisible
              ? (zh
                  ? "如果 QQ 没有打开，请确认设备已安装并登录 QQ，或复制 QQ 号后在客户端搜索。"
                  : "If QQ did not open, make sure it is installed and signed in, or copy the QQ number and search in the app.")
              : ""}
        </div>
        <footer>
          {zh
            ? "客服不会要求你在订单表单中提交第三方账号密码或银行卡资料。"
            : "Support will not ask for third-party passwords or card details in the order form."}
        </footer>
        {qrChannel?.qrImageUrl && (
          <div
            className="wechat-qr-layer"
            onPointerDown={(event) => {
              if (event.currentTarget === event.target) {
                setQrChannel(null);
                setQrStatus("");
              }
            }}
          >
            <section aria-modal="true" className="wechat-qr-sheet" role="dialog">
              <header>
                <div>
                  <small>{zh ? "微信客服" : "WeChat support"}</small>
                  <h3>{qrChannel.label}</h3>
                </div>
                <button
                  aria-label={zh ? "关闭二维码" : "Close QR image"}
                  onClick={() => {
                    setQrChannel(null);
                    setQrStatus("");
                  }}
                  type="button"
                >
                  <X aria-hidden="true" size={18} />
                </button>
              </header>
              <a href={qrChannel.qrImageUrl} rel="noreferrer" target="_blank">
                <img alt={zh ? `${qrChannel.label} 微信二维码` : `${qrChannel.label} WeChat QR code`} src={qrChannel.qrImageUrl} />
              </a>
              <p>{zh
                ? "点击图片可打开原图。手机不支持系统保存面板时，请长按原图保存到相册。"
                : "Tap the image to open the original. If system save options are unavailable, press and hold the original to save it."}</p>
              <div>
                <button disabled={qrBusy} onClick={() => void saveQr(qrChannel)} type="button">
                  <DownloadSimple aria-hidden="true" size={17} />
                  {qrBusy ? (zh ? "正在准备…" : "Preparing…") : (zh ? "保存二维码" : "Save QR image")}
                </button>
                <button onClick={() => void copyAccount(qrChannel)} type="button">
                  <Copy aria-hidden="true" size={17} />
                  {zh ? "复制微信号" : "Copy WeChat ID"}
                </button>
              </div>
              <span aria-live="polite" role="status">{qrStatus}</span>
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}
