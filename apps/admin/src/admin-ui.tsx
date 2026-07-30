import {
  ArrowsClockwise,
  Question,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import {
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type { Locale } from "./api";
import { adminCopy } from "./i18n";
import type { AsyncViewState } from "./admin-model";

export const statusLabels: Record<string, Record<Locale, string>> = {
  DRAFT: { zh: "草稿", en: "Draft" },
  ACTIVE: { zh: "已启用", en: "Active" },
  INACTIVE: { zh: "已停用", en: "Inactive" },
  ARCHIVED: { zh: "已归档", en: "Archived" },
  MANUAL_PENDING: { zh: "待人工确认", en: "Manual review" },
  CONTACTED: { zh: "已联系", en: "Contacted" },
  AWAITING_PAYMENT: { zh: "等待付款", en: "Awaiting payment" },
  PAYMENT_PROCESSING: { zh: "付款处理中", en: "Payment processing" },
  PAID: { zh: "已付款", en: "Paid" },
  FULFILLING: { zh: "交付中", en: "Fulfilling" },
  COMPLETED: { zh: "已完成", en: "Completed" },
  CANCELLED: { zh: "已取消", en: "Cancelled" },
  REFUND_PENDING: { zh: "等待退款", en: "Refund pending" },
  REFUNDED: { zh: "已退款", en: "Refunded" },
  DISPUTED: { zh: "争议中", en: "Disputed" },
  SUCCEEDED: { zh: "成功", en: "Succeeded" },
  FAILED: { zh: "失败", en: "Failed" },
  DENIED: { zh: "已拒绝", en: "Denied" },
  INVITED: { zh: "待设置", en: "Pending setup" },
  LOCKED: { zh: "已锁定", en: "Locked" },
  DISABLED: { zh: "已停用", en: "Disabled" },
};

export function formatDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(
    locale === "zh" ? "zh-CN" : "en-US",
    { dateStyle: "medium", timeStyle: "short" },
  ).format(new Date(value));
}

export function StatusPill({ status, locale }: { status: string; locale: Locale }) {
  return <span className={`status-pill is-${status.toLocaleLowerCase()}`}>{statusLabels[status]?.[locale] ?? status}</span>;
}

export function PanelState({
  state,
  locale,
  retry,
  kind = "table",
}: {
  state: AsyncViewState;
  locale: Locale;
  retry: () => void;
  kind?: "table" | "cards" | "dashboard";
}) {
  const t = adminCopy[locale];
  if (state === "initial-loading") {
    return (
      <div className={`panel-skeleton is-${kind}`} aria-label={t.loading as string} aria-busy="true">
        {Array.from({ length: kind === "dashboard" ? 4 : 6 }, (_, index) => <span key={index} />)}
      </div>
    );
  }
  if (state === "empty") return <div className="table-empty" role="status">{t.empty as string}</div>;
  const offline = state === "offline";
  const forbidden = state === "forbidden";
  return (
    <div className={`panel-state is-${state}`} role="alert">
      <WarningCircle aria-hidden="true" />
      <p>{forbidden ? t.forbidden as string : offline ? t.offline as string : t.loadError as string}</p>
      {!forbidden && <button onClick={retry}>{t.retry as string}</button>}
    </div>
  );
}

export function RefreshNotice({
  state,
  locale,
  retry,
  slow,
}: {
  state: AsyncViewState;
  locale: Locale;
  retry: () => void;
  slow: boolean;
}) {
  const t = adminCopy[locale];
  if (state === "refreshing") {
    return <div className="panel-refresh" role="status"><ArrowsClockwise className="spin" />{slow ? t.slowNetwork as string : t.refreshing as string}</div>;
  }
  if (state !== "error" && state !== "offline" && state !== "forbidden") return null;
  return (
    <div className="panel-refresh is-error" role="alert">
      <WarningCircle />
      {state === "forbidden" ? t.forbidden as string : state === "offline" ? t.offline as string : t.refreshFailed as string}
      {state !== "forbidden" && <button onClick={retry}>{t.retry as string}</button>}
    </div>
  );
}

export function HelpTip({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  const panelId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const closeFromOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeFromKeyboard = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", closeFromKeyboard, true);
    return () => {
      document.removeEventListener("pointerdown", closeFromOutside);
      document.removeEventListener("keydown", closeFromKeyboard, true);
    };
  }, [open]);

  return (
    <span className={`admin-help-tip${open ? " is-open" : ""}`} ref={rootRef}>
      <button
        aria-controls={panelId}
        aria-describedby={open ? panelId : undefined}
        aria-expanded={open}
        aria-label={label}
        className="admin-help-trigger"
        onClick={() => setOpen((current) => !current)}
        ref={triggerRef}
        type="button"
      >
        <Question aria-hidden="true" weight="bold" />
      </button>
      {open && (
        <span className="admin-help-popover" id={panelId} role="tooltip">
          {children}
        </span>
      )}
    </span>
  );
}

export function Dialog({
  title,
  onClose,
  wide = false,
  children,
  closeLabel,
  help,
  helpLabel,
}: {
  title: string;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
  closeLabel: string;
  help?: React.ReactNode;
  helpLabel?: string;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = dialogRef.current;
    const focusable = dialog?.querySelector<HTMLElement>(
      "input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])",
    );
    focusable?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(
        "input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])",
      ));
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={dialogRef} className={`admin-dialog ${wide ? "is-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header>
          <div className="admin-dialog-title">
            <h2 id={titleId}>{title}</h2>
            {help && helpLabel && <HelpTip label={helpLabel}>{help}</HelpTip>}
          </div>
          <button aria-label={closeLabel} onClick={onClose}><X /></button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);
}

export function AdminShellSkeleton({ label, locale }: { label: string; locale: Locale }) {
  return (
    <div className="admin-shell admin-shell-skeleton" aria-label={label} aria-busy="true">
      <aside>
        <div className="skeleton-brand" />
        {Array.from({ length: 7 }, (_, index) => <span key={index} />)}
      </aside>
      <section className="admin-main">
        <header className="admin-topbar"><div className="skeleton-title" /></header>
        <div className="admin-content"><PanelState state="initial-loading" locale={locale} retry={() => undefined} kind="dashboard" /></div>
      </section>
    </div>
  );
}
