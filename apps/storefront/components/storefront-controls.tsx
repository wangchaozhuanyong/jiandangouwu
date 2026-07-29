"use client";

import {
  ArrowSquareOut,
  CaretDown,
  Check,
  ChatsCircle,
  Copy,
  EnvelopeSimple,
  Headset,
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
        <b>{activeCurrency?.token ?? value}</b>
        <span>
          <strong>{activeCurrency?.code ?? value}</strong>
          {variant === "catalog" && <small>{activeCurrency?.name ?? ""}</small>}
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
              <span><strong>{currency.code}</strong><small>{currency.name}</small></span>
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
  const [config, setConfig] = useState<StorefrontConfig | null>(initialConfig);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">(initialConfig ? "ready" : "idle");
  const [copied, setCopied] = useState("");
  const [copyError, setCopyError] = useState(false);
  const zh = locale === "zh";

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
  }, [initialConfig, locale]);

  useEffect(() => {
    if (!open || state !== "idle") return;
    void loadChannels();
  }, [open, state]);

  useEffect(() => {
    if (!open) return undefined;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => closeRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
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
      window.setTimeout(() => setCopied(""), 1600);
    } catch {
      setCopyError(true);
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
        {state === "ready" && config?.channels.length === 0 && (
          <div className="support-drawer__error" role="status">
            <Headset aria-hidden="true" size={24} />
            <strong>{zh ? "客服渠道尚未配置" : "No support channels configured"}</strong>
            <p>{zh ? "请稍后再试。" : "Please try again later."}</p>
          </div>
        )}
        {state === "ready" && Boolean(config?.channels.length) && (
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
                  <div className="support-channel__actions">
                    {directTarget && (
                      <a
                        href={directTarget}
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
                              : (zh ? "打开 QQ" : "Open QQ")}
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
          {copyError ? (zh ? "复制失败，请手动选择上方账号。" : "Copy failed. Select the account above manually.") : ""}
        </div>
        <footer>
          {zh
            ? "客服不会要求你在订单表单中提交第三方账号密码或银行卡资料。"
            : "Support will not ask for third-party passwords or card details in the order form."}
        </footer>
      </aside>
    </div>
  );
}
