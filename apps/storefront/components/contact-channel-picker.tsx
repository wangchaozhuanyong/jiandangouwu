"use client";

import type {
  ContactChannelType,
  Locale,
  StorefrontChannel,
} from "@cloudbridge/contracts";
import {
  CaretDown,
  Check,
  ChatsCircle,
  EnvelopeSimple,
  TelegramLogo,
  WechatLogo,
  WhatsappLogo,
  X,
} from "@phosphor-icons/react";
import {
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

const channelIcons = {
  WHATSAPP: WhatsappLogo,
  EMAIL: EnvelopeSimple,
  TELEGRAM: TelegramLogo,
  WECHAT: WechatLogo,
  QQ: ChatsCircle,
} satisfies Record<ContactChannelType, typeof ChatsCircle>;

export function ContactChannelPicker({
  ariaLabel,
  channels,
  disabled,
  locale,
  onChange,
  value,
}: {
  ariaLabel: string;
  channels: StorefrontChannel[];
  disabled: boolean;
  locale: Locale;
  onChange: (value: ContactChannelType) => void;
  value: ContactChannelType | "";
}) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState(false);
  const selectedIndex = Math.max(0, channels.findIndex((channel) => channel.type === value));
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const selected = channels[selectedIndex] ?? null;
  const zh = locale === "zh";

  const focusOption = (index: number) => {
    if (!channels.length) return;
    const next = (index + channels.length) % channels.length;
    setActiveIndex(next);
    window.requestAnimationFrame(() => optionRefs.current[next]?.focus());
  };

  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const openMenu = (index = selectedIndex) => {
    if (disabled || !channels.length) return;
    setOpen(true);
    focusOption(index);
  };

  useEffect(() => {
    if (!open) return undefined;
    const mobile = window.matchMedia("(max-width: 760px)").matches;
    const previousOverflow = document.body.style.overflow;
    if (mobile) document.body.style.overflow = "hidden";
    const pointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
        return;
      }
      if (event.key !== "Tab" || !mobile) return;
      const focusable = optionRefs.current.filter(Boolean) as HTMLButtonElement[];
      const closeButton = rootRef.current?.querySelector<HTMLButtonElement>(".contact-picker__close");
      if (closeButton) focusable.unshift(closeButton);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("pointerdown", pointerDown);
    document.addEventListener("keydown", keyDown);
    return () => {
      document.removeEventListener("pointerdown", pointerDown);
      document.removeEventListener("keydown", keyDown);
      if (mobile) document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const choose = (channel: StorefrontChannel) => {
    onChange(channel.type);
    close(true);
  };

  return (
    <div className="contact-picker" ref={rootRef}>
      <button
        aria-controls={menuId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className="contact-picker__trigger"
        disabled={disabled || !channels.length}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            openMenu(event.key === "ArrowDown" ? selectedIndex : selectedIndex - 1);
          }
        }}
        ref={triggerRef}
        role="combobox"
        type="button"
      >
        {selected ? (() => {
          const Icon = channelIcons[selected.type];
          return (
            <>
              <span><Icon aria-hidden="true" size={19} /></span>
              <span>
                <strong>{selected.label}</strong>
                <small>{selected.serviceHours}</small>
              </span>
            </>
          );
        })() : <span><strong>{ariaLabel}</strong></span>}
        <CaretDown aria-hidden="true" size={16} />
      </button>
      {open && (
        <div
          className="contact-picker__layer"
          onPointerDown={(event) => {
            if (event.currentTarget === event.target) close(true);
          }}
        >
          <div aria-label={ariaLabel} className="contact-picker__menu" id={menuId} role="listbox">
            <i aria-hidden="true" className="contact-picker__handle" />
            <header>
              <div>
                <small>{zh ? "联系方式" : "Contact channel"}</small>
                <strong>{zh ? "选择客服联系渠道" : "Choose a support channel"}</strong>
              </div>
              <button
                aria-label={zh ? "关闭渠道选择" : "Close channel selection"}
                className="contact-picker__close"
                onClick={() => close(true)}
                type="button"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </header>
            <div className="contact-picker__options">
              {channels.map((channel, index) => {
                const Icon = channelIcons[channel.type];
                const isSelected = channel.type === value;
                return (
                  <button
                    aria-selected={isSelected}
                    className={isSelected ? "is-selected" : ""}
                    key={channel.type}
                    onClick={() => choose(channel)}
                    onFocus={() => setActiveIndex(index)}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                        event.preventDefault();
                        focusOption(index + (event.key === "ArrowDown" ? 1 : -1));
                      } else if (event.key === "Home" || event.key === "End") {
                        event.preventDefault();
                        focusOption(event.key === "Home" ? 0 : channels.length - 1);
                      } else if (event.key === "Escape") {
                        event.preventDefault();
                        close(true);
                      }
                    }}
                    ref={(node) => {
                      optionRefs.current[index] = node;
                    }}
                    role="option"
                    tabIndex={activeIndex === index ? 0 : -1}
                    type="button"
                  >
                    <span><Icon aria-hidden="true" size={21} /></span>
                    <span>
                      <strong>{channel.label}</strong>
                      <small>{channel.serviceHours}</small>
                    </span>
                    {isSelected && <Check aria-hidden="true" size={18} weight="bold" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
