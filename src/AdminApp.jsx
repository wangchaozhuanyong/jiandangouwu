import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowSquareOut,
  ArrowsClockwise,
  Bell,
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  ChatsCircle,
  Check,
  CheckCircle,
  Clock,
  CloudArrowUp,
  Copy,
  CurrencyCircleDollar,
  Database,
  DotsSixVertical,
  DownloadSimple,
  EnvelopeSimple,
  Eye,
  Image as ImageIcon,
  Key,
  List,
  ListMagnifyingGlass,
  LockKey,
  MagnifyingGlass,
  Package,
  PaperPlaneTilt,
  PencilSimple,
  PlugsConnected,
  PushPin,
  Pulse,
  QrCode,
  Receipt,
  ShieldCheck,
  SidebarSimple,
  SlidersHorizontal,
  SquaresFour,
  TelegramLogo,
  Translate,
  UploadSimple,
  UserCircle,
  UserPlus,
  UsersThree,
  WarningCircle,
  WechatLogo,
  WhatsappLogo,
  X,
} from "@phosphor-icons/react";
import {
  auditEvents,
  copy,
  currencies,
  heroes,
  merchantChannels,
  mockOrders,
  products,
  statusText,
  teamMembers,
} from "./data.js";
import {
  filterCatalogProducts,
  moveProductCategory,
  sortProductCategories,
} from "./catalog.js";
import {
  ADMIN_NAVIGATION,
  closeAdminTab,
  findAdminGroup,
  flattenAdminNavigation,
  openAdminTab,
  partitionAdminTabs,
  partitionMobileAdminTabs,
  reorderAdminTabs,
  toggleExpandedGroup,
} from "./admin-navigation.js";
import {
  BackupsPage,
  DataSecurityPage,
  DisputesPage,
  PaymentsPage,
  ReconciliationPage,
  SecretsPage,
  SecurityDesignPage,
  SecurityEventsPage,
} from "./AdminDesignPages.jsx";
import { BrandMark } from "./BrandMark.jsx";
import { TransitServiceLink } from "./TransitServiceLink.jsx";
import TelegramBotPage from "./TelegramBotPage.jsx";
import {
  normalizeTransitServiceUrl,
  validateTransitServiceUrl,
} from "./transit-service.js";

const routeFromHash = () => window.location.hash.replace(/^#/, "") || "/home";
const go = (path) => {
  window.location.hash = path;
};

const channelIcons = {
  whatsapp: WhatsappLogo,
  wechat: WechatLogo,
  qq: ChatsCircle,
  email: EnvelopeSimple,
  telegram: PaperPlaneTilt,
};

const getChannelLabel = (channel, lang) => {
  const configured = merchantChannels.find((item) => item.type === channel || item.label.en === channel);
  return configured?.label?.[lang] ?? channel;
};

const formatDateTime = (value, lang) => new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: lang !== "zh",
}).format(new Date(value));

const formatTableDateTime = (value) => new Intl.DateTimeFormat("sv-SE", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
}).format(new Date(value));

const formatAuditEvent = (event, lang) => {
  const actor = event.actor[lang];
  if (event.type === "CONTACT_REVEALED") {
    return lang === "zh"
      ? `${actor} 查看了订单 ${event.target} 的完整联系方式`
      : `${actor} revealed the full contact for order ${event.target}`;
  }
  if (event.type === "TRANSLATION_UPDATED") {
    return lang === "zh"
      ? `${actor} 更新了 ${event.target} 的英文商品介绍`
      : `${actor} updated the English description for ${event.target}`;
  }
  if (event.type === "PAYMENT_CONFIRMED") {
    return lang === "zh"
      ? `${actor} 将订单 ${event.target} 的付款状态改为已付款`
      : `${actor} marked payment as paid for order ${event.target}`;
  }
  return lang === "zh"
    ? `${actor} 完成法币汇率更新，共 ${event.target} 个币种`
    : `${actor} refreshed fiat rates for ${event.target} currencies`;
};

const adminNavigationIcons = {
  ArrowsClockwise,
  Bell,
  ChatsCircle,
  CloudArrowUp,
  CurrencyCircleDollar,
  Database,
  ImageIcon,
  Key,
  List,
  ListMagnifyingGlass,
  LockKey,
  Package,
  PlugsConnected,
  Receipt,
  ShieldCheck,
  SlidersHorizontal,
  SquaresFour,
  TelegramLogo,
  Translate,
  UsersThree,
  WarningCircle,
};

const adminNav = ADMIN_NAVIGATION.map((entry) => ({
  ...entry,
  icon: adminNavigationIcons[entry.icon],
  items: entry.kind === "group"
    ? entry.items.map((item) => ({ ...item, icon: adminNavigationIcons[item.icon] }))
    : undefined,
}));

const flatAdminItems = flattenAdminNavigation(adminNav);

function CurrencyToken({ currency, compact = false }) {
  return (
    <span className={`currency-token ${compact ? "currency-token--compact" : ""} ${currency.code === "USDT" ? "is-usdt" : ""}`}>
      <span>{currency.token}</span>
      <i aria-hidden="true" />
    </span>
  );
}

function LanguageToggle({ lang, setLang, compact = false }) {
  const t = copy[lang];
  return (
    <div className={`language-toggle ${compact ? "is-compact" : ""}`} aria-label={lang === "zh" ? "语言切换" : "Language switch"}>
      <button className={lang === "zh" ? "is-active" : ""} aria-pressed={lang === "zh"} onClick={() => setLang("zh")}>{t.languageChinese}</button>
      <span />
      <button className={lang === "en" ? "is-active" : ""} aria-pressed={lang === "en"} onClick={() => setLang("en")}>{t.languageEnglish}</button>
    </div>
  );
}

function IconButton({ label, children, onClick, className = "" }) {
  return (
    <button type="button" className={`icon-button ${className}`} aria-label={label} title={label} onClick={onClick}>
      {children}
    </button>
  );
}

function Modal({ open, onClose, children, className = "", label }) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    document.body.classList.add("is-modal-open");
    requestAnimationFrame(() => dialogRef.current?.focus());
    const onKey = (event) => {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter((node) => !node.hasAttribute("hidden"));
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.classList.remove("is-modal-open");
      previous?.focus?.();
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="modal-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={`modal-panel ${className}`} role="dialog" aria-modal="true" aria-label={label} tabIndex="-1" ref={dialogRef}>
        {children}
      </div>
    </div>
  );
}

function DrawerHeader({ title, subtitle, onClose, lang = "en" }) {
  return (
    <div className="drawer-header">
      <div>
        <p className="eyebrow">{subtitle}</p>
        <h2>{title}</h2>
      </div>
      <IconButton label={lang === "zh" ? "关闭" : "Close"} onClick={onClose}><X size={20} /></IconButton>
    </div>
  );
}

function AdminSidebar({
  page,
  lang,
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
  expandedGroupId,
  setExpandedGroupId,
}) {
  const openGroup = (groupId) => {
    if (collapsed) {
      setCollapsed(false);
      setExpandedGroupId(groupId);
      return;
    }
    setExpandedGroupId((current) => toggleExpandedGroup(current, groupId));
  };

  return (
    <>
      <aside className={`admin-sidebar ${collapsed ? "is-collapsed" : ""} ${mobileOpen ? "is-mobile-open" : ""}`}>
        <div className="admin-brand">
          <button onClick={() => { setExpandedGroupId(null); setMobileOpen(false); go("/admin/dashboard"); }}><BrandMark size="admin" /><span><strong>CloudBridge</strong></span></button>
          <IconButton label={lang === "zh" ? (collapsed ? "展开导航" : "收起导航") : (collapsed ? "Expand navigation" : "Collapse navigation")} onClick={() => setCollapsed(!collapsed)}><SidebarSimple size={18} /></IconButton>
        </div>
        <nav className="admin-nav" aria-label={lang === "zh" ? "管理后台导航" : "Admin navigation"}>
          {adminNav.map((entry) => {
            const EntryGlyph = entry.icon;
            if (entry.kind === "link") {
              const linkIsActive = page === entry.id;
              return (
                <button
                  type="button"
                  className={`admin-nav__link ${linkIsActive ? "is-active" : ""}`}
                  key={entry.id}
                  aria-current={linkIsActive ? "page" : undefined}
                  title={entry.label[lang]}
                  onClick={() => {
                    setExpandedGroupId(null);
                    setMobileOpen(false);
                    go(`/admin/${entry.id}`);
                  }}
                >
                  <span className="admin-nav__group-glyph"><EntryGlyph size={21} /></span>
                  <span className="admin-nav__group-label">{entry.label[lang]}</span>
                </button>
              );
            }

            const groupIsActive = entry.items.some((item) => item.id === page);
            const groupIsOpen = expandedGroupId === entry.id && !collapsed;
            const itemRegionId = `admin-nav-group-${entry.id}`;
            return (
              <div className={`admin-nav__group ${groupIsOpen ? "is-open" : ""} ${groupIsActive ? "has-active" : ""}`} key={entry.id}>
                <button
                  type="button"
                  className="admin-nav__group-trigger"
                  aria-expanded={groupIsOpen}
                  aria-controls={itemRegionId}
                  title={entry.label[lang]}
                  onClick={() => openGroup(entry.id)}
                >
                  <span className="admin-nav__group-glyph"><EntryGlyph size={21} /></span>
                  <span className="admin-nav__group-label">{entry.label[lang]}</span>
                  <CaretRight className="admin-nav__group-caret" size={16} />
                </button>
                <div className="admin-nav__items" id={itemRegionId} hidden={!groupIsOpen}>
                  {entry.items.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={page === item.id ? "is-active" : ""}
                      aria-current={page === item.id ? "page" : undefined}
                      title={item.label[lang]}
                      onClick={() => {
                        setExpandedGroupId(entry.id);
                        setMobileOpen(false);
                        go(`/admin/${item.id}`);
                      }}
                    >
                      <span className="admin-nav__item-node" aria-hidden="true" />
                      <span className="nav-label">{item.label[lang]}</span>
                      {item.badge && <em>{item.badge}</em>}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="admin-user-mini">
          <span>{lang === "zh" ? "王" : "W"}</span><div><strong>{lang === "zh" ? "王朝" : "Wang Chao"}</strong><small>{lang === "zh" ? "超级管理员" : "Super admin"}</small></div><CaretRight size={15} />
        </div>
      </aside>
      {mobileOpen && <button className="sidebar-scrim" aria-label={lang === "zh" ? "关闭导航" : "Close navigation"} onClick={() => setMobileOpen(false)} />}
    </>
  );
}

function AdminTopbar({ page, lang, setLang, collapsed, setCollapsed, setMobileOpen, onNotifications, onSignOut }) {
  const active = flatAdminItems.find((item) => item.id === page);
  return (
    <header className="admin-topbar">
      <div className="admin-breadcrumb">
        <IconButton label={lang === "zh" ? "打开导航" : "Open navigation"} className="mobile-menu-button" onClick={() => { setCollapsed(false); setMobileOpen(true); }}><List size={20} /></IconButton>
        <IconButton label={lang === "zh" ? (collapsed ? "展开导航" : "收起导航") : (collapsed ? "Expand navigation" : "Collapse navigation")} className="desktop-collapse-button" onClick={() => setCollapsed(!collapsed)}><SidebarSimple size={19} /></IconButton>
        <h1 id="admin-page-title">{active?.label[lang]}</h1>
      </div>
      <div className="admin-topbar__actions">
        <button className="global-search"><MagnifyingGlass size={17} /><span>{lang === "zh" ? "搜索订单、商品、员工…" : "Search orders, products, team…"}</span><kbd>⌘ K</kbd></button>
        <LanguageToggle lang={lang} setLang={setLang} compact />
        <button className="system-health" onClick={() => go("/admin/security-events")} title={lang === "zh" ? "证据更新于 2 分钟前" : "Evidence updated 2 minutes ago"}><i />{lang === "zh" ? "2 项需处理" : "2 need review"}</button>
        <IconButton label={lang === "zh" ? "通知" : "Notifications"} className="notification-button" onClick={onNotifications}><Bell size={19} /><i /></IconButton>
        <button className="topbar-avatar" aria-label={lang === "zh" ? "退出管理员账户" : "Sign out admin account"} title={lang === "zh" ? "退出登录" : "Sign out"} onClick={onSignOut}>{lang === "zh" ? "王" : "W"}</button>
      </div>
    </header>
  );
}

function AdminWorkspaceTabs({ page, lang, openTabs, setOpenTabs }) {
  const containerRef = useRef(null);
  const moreButtonRef = useRef(null);
  const menuRef = useRef(null);
  const pendingTabFocusRef = useRef(null);
  const pendingSortFocusRef = useRef(null);
  const pointerGestureRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 760px)").matches);
  const [tabLayout, setTabLayout] = useState({ visible: openTabs, overflow: [] });
  const [dragState, setDragState] = useState(null);
  const [sortAnnouncement, setSortAnnouncement] = useState("");
  const isSorting = Boolean(dragState);
  const tabItems = openTabs
    .map((id) => flatAdminItems.find((item) => item.id === id))
    .filter(Boolean);
  const overflowItems = tabLayout.overflow
    .map((id) => flatAdminItems.find((item) => item.id === id))
    .filter(Boolean);
  const labelForTab = (tabId) => (
    flatAdminItems.find((item) => item.id === tabId)?.label?.[lang] || tabId
  );

  const clearPointerGesture = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    const gesture = pointerGestureRef.current;
    if (
      gesture?.handle?.hasPointerCapture?.(gesture.pointerId)
      && gesture.handle.releasePointerCapture
    ) {
      gesture.handle.releasePointerCapture(gesture.pointerId);
    }
    pointerGestureRef.current = null;
  };

  const requestSortFocus = (tabId, surface) => {
    pendingSortFocusRef.current = { tabId, surface };
  };

  const commitReorder = (sourceId, targetId, placement, surface) => {
    const nextTabs = reorderAdminTabs(openTabs, sourceId, targetId, placement);
    const changed = nextTabs.some((id, index) => id !== openTabs[index]);
    setOpenTabs(nextTabs);
    setDragState(null);
    clearPointerGesture();
    requestSortFocus(sourceId, surface);
    setSortAnnouncement(changed
      ? (
        lang === "zh"
          ? `已将${labelForTab(sourceId)}移动到第 ${nextTabs.indexOf(sourceId) + 1} 位`
          : `${labelForTab(sourceId)} moved to position ${nextTabs.indexOf(sourceId) + 1}`
      )
      : (
        lang === "zh"
          ? `${labelForTab(sourceId)}的位置未改变`
          : `${labelForTab(sourceId)} stayed in the same position`
      ));
  };

  const cancelSort = (restoreFocus = true) => {
    const cancelled = dragState;
    setDragState(null);
    clearPointerGesture();
    if (!cancelled) return;
    if (restoreFocus) requestSortFocus(cancelled.sourceId, cancelled.surface);
    setSortAnnouncement(
      lang === "zh"
        ? `已取消移动${labelForTab(cancelled.sourceId)}`
        : `Cancelled moving ${labelForTab(cancelled.sourceId)}`,
    );
  };

  const keyboardTargetForIndex = (sourceId, destinationIndex) => {
    const remaining = openTabs.filter((id) => id !== sourceId);
    if (!remaining.length) return null;
    const minimumIndex = remaining[0] === "dashboard" ? 1 : 0;
    const nextIndex = Math.min(
      remaining.length,
      Math.max(minimumIndex, destinationIndex),
    );
    if (nextIndex >= remaining.length) {
      return {
        targetId: remaining[remaining.length - 1],
        placement: "after",
        destinationIndex: nextIndex,
      };
    }
    return {
      targetId: remaining[nextIndex],
      placement: remaining[nextIndex] === "dashboard" ? "after" : "before",
      destinationIndex: nextIndex,
    };
  };

  const beginPointerSort = () => {
    const gesture = pointerGestureRef.current;
    if (!gesture || gesture.active) return;
    gesture.active = true;
    gesture.targetId = gesture.sourceId;
    gesture.placement = "before";
    setDragState({
      sourceId: gesture.sourceId,
      targetId: gesture.sourceId,
      placement: "before",
      destinationIndex: openTabs.indexOf(gesture.sourceId),
      surface: gesture.surface,
      mode: "pointer",
    });
    setSortAnnouncement(
      lang === "zh"
        ? `正在移动${labelForTab(gesture.sourceId)}`
        : `Moving ${labelForTab(gesture.sourceId)}`,
    );
  };

  const onSortPointerDown = (event, tabId, surface) => {
    if (tabId === "dashboard" || isSorting) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointerGestureRef.current = {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      sourceId: tabId,
      targetId: tabId,
      placement: "before",
      surface,
      handle: event.currentTarget,
      originX: event.clientX,
      originY: event.clientY,
      active: false,
    };
    if (event.pointerType === "mouse") {
      beginPointerSort();
      return;
    }
    longPressTimerRef.current = window.setTimeout(beginPointerSort, 220);
  };

  const onSortPointerMove = (event) => {
    const gesture = pointerGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const distance = Math.hypot(
      event.clientX - gesture.originX,
      event.clientY - gesture.originY,
    );
    if (!gesture.active) {
      if (distance > 8) clearPointerGesture();
      return;
    }

    event.preventDefault();
    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest?.("[data-sort-target]");
    if (!target || target.dataset.sortSurface !== gesture.surface) {
      gesture.targetId = gesture.sourceId;
      gesture.placement = "before";
      setDragState((current) => (
        current
          ? { ...current, targetId: current.sourceId, placement: "before" }
          : current
      ));
      return;
    }

    const targetId = target.dataset.sortTarget;
    const rect = target.getBoundingClientRect();
    const horizontal = gesture.surface === "bar";
    const pointerPosition = horizontal ? event.clientX : event.clientY;
    const midpoint = horizontal
      ? rect.left + (rect.width / 2)
      : rect.top + (rect.height / 2);
    const placement = targetId === "dashboard"
      ? "after"
      : pointerPosition < midpoint
        ? "before"
        : "after";

    gesture.targetId = targetId;
    gesture.placement = placement;
    setDragState((current) => {
      if (
        !current
        || (current.targetId === targetId && current.placement === placement)
      ) {
        return current;
      }
      return { ...current, targetId, placement };
    });

    if (gesture.surface === "menu" && menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      const edgeSize = 56;
      if (event.clientY < menuRect.top + edgeSize) menuRef.current.scrollTop -= 18;
      if (event.clientY > menuRect.bottom - edgeSize) menuRef.current.scrollTop += 18;
    }
  };

  const onSortPointerUp = (event) => {
    const gesture = pointerGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.preventDefault();
    if (gesture.active) {
      commitReorder(
        gesture.sourceId,
        gesture.targetId,
        gesture.placement,
        gesture.surface,
      );
      return;
    }
    clearPointerGesture();
  };

  const onSortPointerCancel = (event) => {
    const gesture = pointerGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (gesture.active) cancelSort();
    else clearPointerGesture();
  };

  const onSortHandleKeyDown = (event, tabId, surface) => {
    const currentSort = dragState?.mode === "keyboard"
      && dragState.sourceId === tabId
      ? dragState
      : null;
    if (!currentSort) {
      if (![" ", "Enter"].includes(event.key) || isSorting) return;
      event.preventDefault();
      event.stopPropagation();
      const destinationIndex = openTabs.indexOf(tabId);
      setDragState({
        sourceId: tabId,
        targetId: tabId,
        placement: "before",
        destinationIndex,
        surface,
        mode: "keyboard",
      });
      setSortAnnouncement(
        lang === "zh"
          ? `已选中${labelForTab(tabId)}，使用方向键调整位置`
          : `${labelForTab(tabId)} picked up. Use arrow keys to move it`,
      );
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancelSort();
      return;
    }
    if ([" ", "Enter"].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      commitReorder(
        currentSort.sourceId,
        currentSort.targetId,
        currentSort.placement,
        currentSort.surface,
      );
      return;
    }

    const previousKey = surface === "bar" ? "ArrowLeft" : "ArrowUp";
    const nextKey = surface === "bar" ? "ArrowRight" : "ArrowDown";
    let destinationIndex = currentSort.destinationIndex;
    if (event.key === previousKey) destinationIndex -= 1;
    else if (event.key === nextKey) destinationIndex += 1;
    else if (event.key === "Home") destinationIndex = 1;
    else if (event.key === "End") destinationIndex = openTabs.length - 1;
    else return;

    event.preventDefault();
    event.stopPropagation();
    const target = keyboardTargetForIndex(tabId, destinationIndex);
    if (!target) return;
    setDragState({ ...currentSort, ...target });
    setSortAnnouncement(
      lang === "zh"
        ? `${labelForTab(tabId)}将移动到第 ${target.destinationIndex + 1} 位`
        : `${labelForTab(tabId)} will move to position ${target.destinationIndex + 1}`,
    );
  };

  const sortClasses = (tabId, surface) => {
    if (!dragState || dragState.surface !== surface) return "";
    const classes = [];
    if (dragState.sourceId === tabId) classes.push("is-dragging");
    if (dragState.targetId === tabId && dragState.sourceId !== tabId) {
      classes.push(dragState.placement === "before" ? "is-drop-before" : "is-drop-after");
    }
    return classes.join(" ");
  };

  const renderSortHandle = (item, surface) => {
    const grabbed = dragState?.sourceId === item.id;
    return (
      <button
        type="button"
        className="admin-workspace-tab__sort-handle"
        aria-label={lang === "zh" ? `调整${item.label.zh}顺序` : `Reorder ${item.label.en}`}
        aria-describedby="admin-tab-sort-instructions"
        aria-keyshortcuts={surface === "bar"
          ? "Space ArrowLeft ArrowRight Home End Escape"
          : "Space ArrowUp ArrowDown Home End Escape"}
        aria-pressed={grabbed}
        data-sort-handle={`${surface}:${item.id}`}
        disabled={Boolean(dragState && !grabbed)}
        title={lang === "zh" ? "拖动调整顺序" : "Drag to reorder"}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onKeyDown={(event) => onSortHandleKeyDown(event, item.id, surface)}
        onPointerDown={(event) => onSortPointerDown(event, item.id, surface)}
        onPointerMove={onSortPointerMove}
        onPointerUp={onSortPointerUp}
        onPointerCancel={onSortPointerCancel}
      >
        <DotsSixVertical size={16} weight="bold" />
      </button>
    );
  };

  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || isSorting) return undefined;

    const measure = () => {
      const widths = Object.fromEntries(openTabs.map((id) => {
        const node = container.querySelector(`[data-tab-measure="${id}"]`);
        const interactionAllowance = id === "dashboard" ? 0 : isMobile ? 22 : 18;
        return [id, (node?.getBoundingClientRect().width || 0) + interactionAllowance];
      }));
      const moreWidth = container.querySelector("[data-more-measure]")?.getBoundingClientRect().width || 92;
      const partition = isMobile ? partitionMobileAdminTabs : partitionAdminTabs;
      setTabLayout(partition({
        tabs: openTabs,
        activeId: page,
        widths,
        availableWidth: container.clientWidth,
        moreWidth,
      }));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [isMobile, isSorting, lang, openTabs, page]);

  useEffect(() => {
    setMenuOpen(false);
    setDragState(null);
    clearPointerGesture();
  }, [page]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointerDown = (event) => {
      if (isSorting) return;
      if (!menuRef.current?.contains(event.target) && !moreButtonRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      if (isSorting) return;
      setMenuOpen(false);
      moreButtonRef.current?.focus();
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => menuRef.current?.querySelector("button")?.focus());
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isSorting, menuOpen]);

  useEffect(() => {
    if (!isSorting) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      cancelSort();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dragState, isSorting]);

  useEffect(() => {
    if (!tabLayout.overflow.length && !isSorting) setMenuOpen(false);
  }, [isSorting, tabLayout.overflow.length]);

  useEffect(() => {
    if (pendingTabFocusRef.current !== page) return undefined;
    const frame = requestAnimationFrame(() => {
      containerRef.current?.querySelector(`[data-workspace-tab="${page}"]`)?.focus();
      pendingTabFocusRef.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [page, tabLayout.visible]);

  useEffect(() => {
    const pending = pendingSortFocusRef.current;
    if (!pending || isSorting) return;
    const frame = requestAnimationFrame(() => {
      const handle = containerRef.current?.querySelector(
        `[data-sort-handle="${pending.surface}:${pending.tabId}"]`,
      );
      if (handle) handle.focus();
      else moreButtonRef.current?.focus();
      pendingSortFocusRef.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [isSorting, menuOpen, openTabs, tabLayout.visible]);

  const closeTab = (tabId) => {
    const result = closeAdminTab(openTabs, tabId, page);
    setOpenTabs(result.tabs);
    if (result.nextActiveId !== page) go(`/admin/${result.nextActiveId}`);
  };

  const activateTab = (tabId) => {
    setMenuOpen(false);
    go(`/admin/${tabId}`);
  };

  const onTabKeyDown = (event, tabId) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = openTabs.indexOf(tabId);
    let nextIndex = currentIndex;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + openTabs.length) % openTabs.length;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % openTabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = openTabs.length - 1;
    const nextId = openTabs[nextIndex];
    pendingTabFocusRef.current = nextId;
    activateTab(nextId);
  };

  return (
    <section
      className={`admin-workspace-tabs ${isSorting ? "is-sorting" : ""}`}
      ref={containerRef}
      aria-label={lang === "zh" ? "已打开页面" : "Open pages"}
    >
      <p className="sr-only" id="admin-tab-sort-instructions">
        {lang === "zh"
          ? "按空格或回车开始排序，使用方向键移动，空格或回车完成，Escape 取消。"
          : "Press Space or Enter to start sorting, use arrow keys to move, press Space or Enter to finish, or Escape to cancel."}
      </p>
      <div className="sr-only" aria-live="polite" aria-atomic="true">{sortAnnouncement}</div>
      <div className="admin-workspace-tabs__list" role="tablist" aria-label={lang === "zh" ? "工作区页面" : "Workspace pages"}>
        {tabLayout.visible.map((tabId) => {
          const item = flatAdminItems.find((entry) => entry.id === tabId);
          if (!item) return null;
          const isActive = tabId === page;
          const pinned = tabId === "dashboard";
          return (
            <div
              className={`admin-workspace-tab ${isActive ? "is-active" : ""} ${sortClasses(tabId, "bar")}`}
              data-sort-target={tabId}
              data-sort-surface="bar"
              key={tabId}
            >
              {!pinned && renderSortHandle(item, "bar")}
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                data-workspace-tab={tabId}
                disabled={isSorting}
                onClick={() => activateTab(tabId)}
                onKeyDown={(event) => onTabKeyDown(event, tabId)}
              >
                <span>{item.label[lang]}</span>
                {pinned && <PushPin size={14} weight="fill" />}
              </button>
              {!pinned && (
                <button
                  type="button"
                  className="admin-workspace-tab__close"
                  aria-label={lang === "zh" ? `关闭${item.label.zh}` : `Close ${item.label.en}`}
                  disabled={isSorting}
                  onClick={() => closeTab(tabId)}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {overflowItems.length > 0 && (
        <div className="admin-workspace-tabs__more">
          <button
            type="button"
            ref={moreButtonRef}
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
            disabled={isSorting}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {lang === "zh" ? "更多" : "More"} {overflowItems.length}<CaretDown size={14} />
          </button>
          {menuOpen && (
            <>
              <button
                type="button"
                className="admin-workspace-tabs__backdrop"
                tabIndex="-1"
                aria-label={lang === "zh" ? "关闭更多页面" : "Close more pages"}
                aria-disabled={isSorting}
                onClick={() => {
                  if (!isSorting) setMenuOpen(false);
                }}
              />
              <div
                className="admin-workspace-tabs__menu"
                role="dialog"
                aria-labelledby="admin-workspace-tabs-menu-title"
                aria-describedby="admin-tab-sort-instructions"
                ref={menuRef}
              >
                <div className="admin-workspace-tabs__menu-header">
                  <strong id="admin-workspace-tabs-menu-title">{lang === "zh" ? "管理已打开页面" : "Manage open pages"}</strong>
                  <small>
                    {lang === "zh"
                      ? `共 ${tabItems.length} 个，隐藏 ${overflowItems.length} 个`
                      : `${tabItems.length} open, ${overflowItems.length} hidden`}
                  </small>
                </div>
                <div className="admin-workspace-tabs__menu-list">
                  {tabItems.map((item) => {
                    const pinned = item.id === "dashboard";
                    return (
                      <div
                        className={`admin-workspace-tabs__menu-row ${item.id === page ? "is-active" : ""} ${pinned ? "is-pinned" : ""} ${sortClasses(item.id, "menu")}`}
                        data-sort-target={item.id}
                        data-sort-surface="menu"
                        key={item.id}
                      >
                        {pinned
                          ? <span className="admin-workspace-tab__pin-slot" aria-hidden="true"><PushPin size={14} weight="fill" /></span>
                          : renderSortHandle(item, "menu")}
                        <button
                          type="button"
                          className="admin-workspace-tabs__menu-activate"
                          disabled={isSorting}
                          onClick={() => activateTab(item.id)}
                        >
                          <span>{item.label[lang]}</span>
                          {pinned && <small>{lang === "zh" ? "固定" : "Pinned"}</small>}
                        </button>
                        {!pinned && (
                          <button
                            type="button"
                            className="admin-workspace-tabs__menu-close"
                            aria-label={lang === "zh" ? `关闭${item.label.zh}` : `Close ${item.label.en}`}
                            disabled={isSorting}
                            onClick={() => closeTab(item.id)}
                          >
                            <X size={15} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}
      <div className="admin-workspace-tabs__measure" aria-hidden="true">
        {tabItems.map((item) => (
          <span data-tab-measure={item.id} key={item.id}>
            {item.id !== "dashboard" && <DotsSixVertical className="admin-workspace-tabs__measure-drag" size={14} />}
            {item.label[lang]}{item.id === "dashboard" ? <PushPin size={14} /> : <X size={14} />}
          </span>
        ))}
        <span data-more-measure>{lang === "zh" ? "更多" : "More"} {Math.max(1, tabItems.length)}<CaretDown size={14} /></span>
      </div>
    </section>
  );
}

function AdminSurfaceToolbar({ summary, action, children }) {
  return (
    <div className="admin-surface-toolbar">
      <span>{summary}</span>
      {children}
      {action}
    </div>
  );
}

function MetricCard({ label, value, meta, tone = "blue", icon: Glyph }) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <div><span className="metric-icon"><Glyph size={19} /></span><small>{label}</small></div>
      <strong>{value}</strong>
      <p>{meta}</p>
    </article>
  );
}

function StatusPill({ status, lang }) {
  return <span className={`status-pill status-${status}`}><i />{statusText[status]?.[lang] || status}</span>;
}

function OrdersTable({ lang, onSelect, rows = mockOrders }) {
  const zh = lang === "zh";
  return (
    <div className="responsive-table admin-data-scroll order-table-scroll">
      <table className="admin-data-table order-data-table" aria-label={zh ? "订单数据表" : "Orders data table"}>
        <thead><tr><th>{zh ? "订单号" : "Order ID"}</th><th>{zh ? "订单时间" : "Order time"}</th><th>{zh ? "商品" : "Product"}</th><th>{zh ? "金额" : "Amount"}</th><th>{zh ? "联系渠道" : "Channel"}</th><th>{zh ? "联系账号" : "Contact account"}</th><th>{zh ? "处理状态" : "Status"}</th><th>{zh ? "付款状态" : "Payment"}</th><th>{zh ? "负责人" : "Owner"}</th><th><span className="sr-only">{zh ? "操作" : "Action"}</span></th></tr></thead>
        <tbody>
          {rows.map((order) => (
            <tr key={order.id} onClick={() => onSelect(order)}>
              <td title={order.id}><strong>{order.id}</strong></td>
              <td title={formatTableDateTime(order.createdAt)}>{formatTableDateTime(order.createdAt)}</td>
              <td title={order.product}>{order.product}</td>
              <td className="order-amount-cell" title={`${order.amount} · ${order.usdt}`}><strong>{order.amount}</strong><small>· {order.usdt}</small></td>
              <td title={getChannelLabel(order.channel, lang)}>{getChannelLabel(order.channel, lang)}</td>
              <td title={order.contact}>{order.contact}</td>
              <td><StatusPill status={order.status} lang={lang} /></td>
              <td><StatusPill status={order.payment} lang={lang} /></td>
              <td title={order.assignee[lang]}>{order.assignee[lang]}</td>
              <td><button aria-label={zh ? `打开订单 ${order.id}` : `Open order ${order.id}`}><CaretRight size={16} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="admin-table-swipe-hint">{zh ? "左右滑动查看全部列" : "Swipe horizontally to view all columns"}</p>
    </div>
  );
}

function DashboardPage({ lang, onSelectOrder }) {
  const zh = lang === "zh";
  return (
    <>
      <section className="metrics-grid">
        <MetricCard icon={Receipt} label={zh ? "今日新订单" : "New today"} value="12" meta={zh ? "4 个等待领取" : "4 awaiting assignment"} />
        <MetricCard icon={Clock} label={zh ? "待联系" : "Awaiting contact"} value="7" meta={zh ? "最久等待 18 分钟" : "Oldest waiting 18 min"} tone="violet" />
        <MetricCard icon={CurrencyCircleDollar} label={zh ? "待确认付款" : "Payment review"} value="3" meta={zh ? "合计 RM 287.00" : "RM 287.00 total"} tone="green" />
        <MetricCard icon={WarningCircle} label={zh ? "需要关注" : "Needs attention"} value="5" meta={zh ? "低库存 3 · 通知失败 2" : "3 low stock · 2 delivery fails"} tone="amber" />
      </section>
      <section className="admin-dashboard-grid">
        <div className="admin-panel recent-orders">
          <div className="panel-heading"><h2>{zh ? "最新订单" : "Latest orders"}</h2><button onClick={() => go("/admin/orders")}>{zh ? "查看待处理" : "View pending"}<ArrowRight size={15} /></button></div>
          <OrdersTable lang={lang} onSelect={onSelectOrder} rows={mockOrders.slice(0, 3)} />
        </div>
        <div className="admin-panel attention-panel">
          <div className="panel-heading"><h2>{zh ? "异常与提醒" : "Attention queue"}</h2></div>
          <div className="attention-list">
            <button><span className="attention-icon amber"><WarningCircle size={19} /></span><div><strong>{zh ? "Claude Pro 仅余 3 件" : "Claude Pro: only 3 left"}</strong><small>{zh ? "建议检查库存安排" : "Review inventory planning"}</small></div><CaretRight size={15} /></button>
            <button><span className="attention-icon red"><EnvelopeSimple size={19} /></span><div><strong>{zh ? "2 条邮件通知发送失败" : "2 email notifications failed"}</strong><small>{zh ? "系统将在 5 分钟后重试" : "Retry scheduled in 5 min"}</small></div><CaretRight size={15} /></button>
            <button><span className="attention-icon blue"><ArrowsClockwise size={19} /></span><div><strong>{zh ? "USDT 汇率 4 分钟前更新" : "USDT rate updated 4 min ago"}</strong><small>1 CNY = 0.1397 USDT</small></div><CheckCircle size={16} /></button>
          </div>
        </div>
        <div className="admin-panel service-panel">
          <div className="panel-heading"><h2>{zh ? "运行状态" : "Service health"}</h2><button onClick={() => go("/admin/integrations")}>{zh ? "系统中心" : "System center"}<ArrowRight size={15} /></button></div>
          <div className="service-grid">
            {[["数据库", "Database", Database], ["对象存储", "Object storage", CloudArrowUp], ["邮件服务", "Email service", EnvelopeSimple], ["汇率任务", "Rate jobs", Pulse]].map(([cn, en, Glyph]) => <div key={en}><span><Glyph size={19} /></span><strong>{zh ? cn : en}</strong><small><i />{zh ? "正常" : "Healthy"}</small></div>)}
          </div>
        </div>
        <div className="admin-panel activity-panel">
          <div className="panel-heading"><h2>{zh ? "最近操作" : "Recent activity"}</h2></div>
          {auditEvents.slice(0, 3).map((event) => <div className="activity-item" key={`${event.type}-${event.createdAt}`}><span>{event.actor[lang][0]}</span><div><strong>{event.actor[lang]}</strong><p>{formatAuditEvent(event, lang)}</p></div><small>{formatDateTime(event.createdAt, lang)}</small></div>)}
        </div>
      </section>
    </>
  );
}

function OrdersPage({ lang, onSelectOrder }) {
  const zh = lang === "zh";
  const [filter, setFilter] = useState("all");
  const filters = [["all", zh ? "全部订单" : "All"], ["new", zh ? "新订单" : "New"], ["contacted", zh ? "待付款" : "Payment"], ["processing", zh ? "处理中" : "Processing"], ["completed", zh ? "已完成" : "Completed"]];
  const rows = filter === "all" ? mockOrders : mockOrders.filter((order) => order.status === filter);
  return (
    <>
      <div className="admin-toolbar">
        <label><MagnifyingGlass size={17} /><input placeholder={zh ? "搜索订单号、商品或联系方式" : "Search order, product or contact"} /></label>
        <div className="filter-tabs">{filters.map(([id, label]) => <button className={filter === id ? "is-active" : ""} onClick={() => setFilter(id)} key={id}>{label}</button>)}</div>
        <div className="admin-toolbar-actions">
          <button className="filter-button"><SlidersHorizontal size={17} />{zh ? "更多筛选" : "Filters"}</button>
          <button className="toolbar-action"><DownloadSimple size={17} />{zh ? "导出" : "Export"}</button>
        </div>
      </div>
      <div className="admin-panel orders-panel"><OrdersTable lang={lang} onSelect={onSelectOrder} rows={rows} /></div>
    </>
  );
}

function ProductAdminCard({ product, lang, onEdit, index, categories }) {
  const zh = lang === "zh";
  const stockState = product.stock === 0 ? "unpaid" : product.stock <= 3 ? "pending" : "completed";
  const category = categories.find((item) => item.id === product.categoryId);
  const modifiedBy = index % 2 === 0 ? (zh ? "王朝" : "Wang Chao") : "Mia Tan";
  const modifiedAt = zh ? `${index + 2} 分钟前` : `${index + 2} min ago`;
  return (
    <article className="admin-product-card">
      <div className="admin-product-identity">
        <img src={product.image} alt="" />
        <h3 title={product.name[lang]}>{product.name[lang]}</h3>
      </div>
      <span className="admin-product-category" title={category?.name?.[lang]}>{category?.name?.[lang] || (zh ? "未分类" : "Uncategorized")}</span>
      <div className="admin-product-price" title={`¥ ${(product.price * 1.62).toFixed(2)} · ${product.usdt.toFixed(2)} USDT`}><strong>¥ {(product.price * 1.62).toFixed(2)}</strong><small>· {product.usdt.toFixed(2)} USDT</small></div>
      <strong className="admin-product-stock">{product.stock === Infinity ? (zh ? "无限" : "Unlimited") : product.stock}</strong>
      <StatusPill status={stockState} lang={lang} />
      <span className="admin-product-modified" title={modifiedBy}>{modifiedBy}</span>
      <time title={modifiedAt}>{modifiedAt}</time>
      <button className="admin-row-action" aria-label={zh ? `编辑 ${product.name[lang]}` : `Edit ${product.name[lang]}`} onClick={() => onEdit(product)}><PencilSimple size={17} />{zh ? "编辑" : "Edit"}</button>
    </article>
  );
}

function ProductsPage({ lang, onEditProduct, categories, catalogProducts }) {
  const zh = lang === "zh";
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const activeCategories = sortProductCategories(categories).filter((category) => category.active);
  const visibleProducts = filterCatalogProducts(catalogProducts, { query, categoryId });
  return (
    <>
      <div className="admin-toolbar">
        <label><MagnifyingGlass size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={zh ? "搜索商品名称" : "Search product names"} /></label>
        <select className="admin-category-select" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} aria-label={zh ? "按分类筛选" : "Filter by category"}>
          <option value="all">{zh ? `全部分类 ${catalogProducts.length}` : `All categories ${catalogProducts.length}`}</option>
          {activeCategories.map((category) => <option value={category.id} key={category.id}>{category.name[lang]}</option>)}
        </select>
        <div className="admin-toolbar-actions">
          <button className="toolbar-primary" onClick={() => onEditProduct(catalogProducts[0])}><Package size={17} />{zh ? "新增商品" : "New product"}</button>
        </div>
      </div>
      <div className="admin-product-list admin-panel admin-data-scroll">
        <div className="admin-product-list__header">
          <span>{zh ? "商品" : "Product"}</span>
          <span>{zh ? "分类" : "Category"}</span>
          <span>{zh ? "价格" : "Pricing"}</span>
          <span>{zh ? "库存" : "Inventory"}</span>
          <span>{zh ? "状态" : "Status"}</span>
          <span>{zh ? "修改人" : "Modified by"}</span>
          <span>{zh ? "修改时间" : "Modified at"}</span>
          <span>{zh ? "操作" : "Action"}</span>
        </div>
        {visibleProducts.map((product) => (
          <ProductAdminCard
            product={product}
            lang={lang}
            onEdit={onEditProduct}
            index={catalogProducts.findIndex((item) => item.id === product.id)}
            categories={categories}
            key={product.id}
          />
        ))}
        {!visibleProducts.length && <div className="admin-empty-state"><MagnifyingGlass size={26} /><strong>{zh ? "没有匹配的商品" : "No matching products"}</strong><span>{zh ? "调整关键词或分类后重试。" : "Try another keyword or category."}</span></div>}
      </div>
    </>
  );
}

function CategoriesPage({
  lang,
  categories,
  catalogProducts,
  onCreateCategory,
  onEditCategory,
  onToggleCategory,
  onMoveCategory,
}) {
  const zh = lang === "zh";
  const sortedCategories = sortProductCategories(categories);
  const assignedCount = catalogProducts.filter((product) => sortedCategories.some((category) => category.id === product.categoryId)).length;
  return (
    <>
      <AdminSurfaceToolbar
        summary={zh ? `${sortedCategories.length} 个分类 · ${assignedCount} 个商品已归类` : `${sortedCategories.length} categories · ${assignedCount} products assigned`}
        action={<button className="toolbar-primary" onClick={onCreateCategory}><Package size={17} />{zh ? "新增分类" : "New category"}</button>}
      />
      <div className="category-admin-list admin-panel admin-data-scroll">
        <div className="category-admin-list__header">
          <span>{zh ? "顺序" : "Order"}</span>
          <span>{zh ? "中文名称" : "Chinese name"}</span>
          <span>{zh ? "英文名称" : "English name"}</span>
          <span>{zh ? "商品数" : "Products"}</span>
          <span>{zh ? "状态" : "Status"}</span>
          <span />
        </div>
        {sortedCategories.map((category, index) => {
          const count = catalogProducts.filter((product) => product.categoryId === category.id).length;
          return (
            <article className="category-admin-row" key={category.id}>
              <div className="category-order">
                <strong>{String(index + 1).padStart(2, "0")}</strong>
                <span>
                  <IconButton label={zh ? "上移分类" : "Move category up"} onClick={() => onMoveCategory(category.id, -1)} className="category-order-button"><CaretUp size={15} /></IconButton>
                  <IconButton label={zh ? "下移分类" : "Move category down"} onClick={() => onMoveCategory(category.id, 1)} className="category-order-button"><CaretDown size={15} /></IconButton>
                </span>
              </div>
              <strong>{category.name.zh}</strong>
              <span>{category.name.en}</span>
              <span>{zh ? `${count} 个商品` : `${count} products`}</span>
              <button className={`category-status ${category.active ? "is-active" : ""}`} aria-pressed={category.active} onClick={() => onToggleCategory(category.id)}>
                <i />{category.active ? (zh ? "显示中" : "Visible") : (zh ? "已隐藏" : "Hidden")}
              </button>
              <button className="admin-row-action" onClick={() => onEditCategory(category)}><PencilSimple size={17} />{zh ? "编辑" : "Edit"}</button>
            </article>
          );
        })}
      </div>
    </>
  );
}

function BannersPage({ lang }) {
  const zh = lang === "zh";
  return (
    <>
      <AdminSurfaceToolbar
        summary={zh ? `${heroes.length} 个轮播故事` : `${heroes.length} hero stories`}
        action={<button className="toolbar-primary"><ImageIcon size={17} />{zh ? "新增轮播" : "New story"}</button>}
      />
      <div className="banner-board">
        {heroes.map((hero, index) => (
          <article className="banner-card" key={hero.image}>
            <div className="banner-drag" aria-label={zh ? "拖动排序" : "Drag to reorder"}><List size={18} /><span>0{index + 1}</span></div>
            <div className="banner-card__visual"><img src={hero.image} alt={hero.title[lang].replace("\n", " ")} /><span className="banner-safe-area">{zh ? "文字安全区" : "Copy safe area"}</span></div>
            <div className="banner-card__content"><div><small>{hero.eyebrow[lang]}</small><StatusPill status="completed" lang={lang} /></div><h3>{hero.title[lang].replace("\n", " ")}</h3><p>{hero.copy[lang]}</p><dl><div><dt>{zh ? "显示位置" : "Placement"}</dt><dd>{zh ? "客户端首页" : "Storefront home"}</dd></div><div><dt>{zh ? "语言完整度" : "Translation"}</dt><dd>{zh ? "中文 100% · 英文 100%" : "Chinese 100% · English 100%"}</dd></div></dl><div><span>{zh ? "桌面与手机共用视觉" : "Shared desktop and mobile visual"}</span><button><PencilSimple size={16} />{zh ? "编辑" : "Edit"}</button></div></div>
          </article>
        ))}
      </div>
    </>
  );
}

function MediaPage({ lang }) {
  const zh = lang === "zh";
  const assets = [...heroes.map((item) => item.image), ...products.map((item) => item.image)];
  return (
    <>
      <div className="media-summary">
        <span><ImageIcon size={19} />{zh ? "12 个资源" : "12 assets"}</span>
        <span><CloudArrowUp size={19} />WebP · 1.2 MB</span>
        <span><CheckCircle size={19} />{zh ? "全部已优化" : "All optimized"}</span>
        <button className="toolbar-primary"><UploadSimple size={17} />{zh ? "上传资源" : "Upload asset"}</button>
      </div>
      <div className="media-grid">{assets.map((src, index) => <article key={src}><img src={src} alt={index < 4 ? (zh ? "CloudBridge 首页轮播资源" : "CloudBridge hero asset") : (zh ? "CloudBridge 商品图片资源" : "CloudBridge product asset")} /><div><strong>{src.split("/").pop()}</strong><small>{index < 4 ? (zh ? "1920 × 1080 · 首页轮播" : "1920 × 1080 · HERO") : (zh ? "1200 × 1200 · 商品主图" : "1200 × 1200 · PRODUCT")}</small><em>{index < 4 ? (zh ? "首页轮播使用中" : "Used by hero") : (zh ? "商品主图使用中" : "Used by product")}</em></div><button aria-label={zh ? "预览资源" : "Preview asset"}><Eye size={17} /></button></article>)}</div>
    </>
  );
}

function TranslationPage({ lang }) {
  const zh = lang === "zh";
  const tasks = [
    { id: "claude", title: "Claude Pro", type: zh ? "商品" : "Product", locale: zh ? "英文" : "English", owner: "Mia Tan", field: zh ? "商品介绍" : "Product description" },
    { id: "refund", title: zh ? "售后退款" : "Refund policy", type: zh ? "政策" : "Policy", locale: zh ? "英文" : "English", owner: zh ? "未分配" : "Unassigned", field: zh ? "政策正文" : "Policy body" },
    { id: "hero", title: zh ? "首页第 4 张轮播" : "Hero story 04", type: zh ? "轮播" : "Hero", locale: zh ? "英文" : "English", owner: "Mia Tan", field: zh ? "图片替代说明" : "Image alt text" },
  ];
  const [selectedId, setSelectedId] = useState("claude");
  const selected = tasks.find((item) => item.id === selectedId);
  return (
    <>
      <AdminSurfaceToolbar
        summary={zh ? "中文完整 · 英文 86%" : "Chinese complete · English 86%"}
        action={<button className="toolbar-action"><ArrowsClockwise size={17} />{zh ? "扫描缺失内容" : "Scan missing copy"}</button>}
      />
      <section className="translation-overview">
        <div><span>{zh ? "中文" : "Chinese"}</span><strong>100%</strong><i><em style={{ width: "100%" }} /></i><small>{zh ? "全部内容完整" : "All content complete"}</small></div>
        <div><span>{zh ? "英文" : "English"}</span><strong>86%</strong><i><em style={{ width: "86%" }} /></i><small>{zh ? "3 项需要完善" : "3 items need work"}</small></div>
      </section>
      <div className="translation-filters">
        <button className="is-active">{zh ? "全部缺失 3" : "All missing 3"}</button>
        <button>{zh ? "商品" : "Products"}</button>
        <button>{zh ? "轮播" : "Hero"}</button>
        <button>{zh ? "政策" : "Policies"}</button>
        <label><MagnifyingGlass size={16} /><input placeholder={zh ? "搜索内容" : "Search content"} /></label>
      </div>
      <div className="translation-workbench">
        <section className="admin-panel translation-list admin-data-scroll">
          <div className="translation-list__header"><span>{zh ? "内容" : "Content"}</span><span>{zh ? "语言" : "Language"}</span><span>{zh ? "缺失字段" : "Missing field"}</span><span>{zh ? "类型" : "Type"}</span><span>{zh ? "负责人" : "Owner"}</span><span>{zh ? "操作" : "Action"}</span></div>
          {tasks.map((task) => <button className={`translation-row ${selectedId === task.id ? "is-selected" : ""}`} key={task.id} onClick={() => setSelectedId(task.id)}><span className="translation-title-cell" title={task.title}><span className="attention-icon amber"><Translate size={18} /></span><strong>{task.title}</strong></span><span title={task.locale}>{task.locale}</span><span title={task.field}>{task.field}</span><em>{task.type}</em><span title={task.owner}>{task.owner}</span><CaretRight size={15} /></button>)}
        </section>
        <aside className="translation-detail admin-panel">
          <small>{selected.locale} · {selected.type}</small>
          <h2>{selected.title}</h2>
          <p>{zh ? `缺少${selected.field}。完成后英文内容完整度将自动更新。` : `${selected.field} is missing. English completeness updates after this task is saved.`}</p>
          <dl><div><dt>{zh ? "当前状态" : "Status"}</dt><dd>{zh ? "待完善" : "Incomplete"}</dd></div><div><dt>{zh ? "负责人" : "Owner"}</dt><dd>{selected.owner}</dd></div><div><dt>{zh ? "回退规则" : "Fallback"}</dt><dd>{zh ? "隐藏未翻译内容" : "Hide untranslated copy"}</dd></div></dl>
          <button className="admin-primary"><PencilSimple size={17} />{zh ? "打开编辑" : "Open editor"}</button>
        </aside>
      </div>
    </>
  );
}

function ContactsPage({ lang }) {
  const zh = lang === "zh";
  return (
    <>
      <AdminSurfaceToolbar
        summary={zh ? `${merchantChannels.length} 个启用渠道` : `${merchantChannels.length} active channels`}
        action={<button className="toolbar-primary"><ChatsCircle size={17} />{zh ? "新增联系方式" : "New channel"}</button>}
      />
      <div className="contact-admin-grid">
        {merchantChannels.map((channel, index) => {
          const Glyph = channelIcons[channel.type];
          const isWechat = channel.type === "wechat";
          return (
            <article key={channel.type}>
              <span className={`channel-icon ${channel.type}`}><Glyph size={27} /></span>
              <div>
                <small>{index === 0 ? (zh ? "主要联系方式" : "Primary channel") : (zh ? "备用渠道" : "Secondary")}</small>
                <h3>{channel.label[lang]}</h3>
                <p>{channel.account}</p>
                <span>{channel.hours}</span>
              </div>
              <StatusPill status="completed" lang={lang} />
              <div className={`contact-channel-mode ${isWechat ? "is-copy-only" : "is-direct"}`}>
                {isWechat ? <QrCode size={16} /> : <ArrowSquareOut size={16} />}
                <span>
                  <strong>
                    {isWechat
                      ? (zh ? "二维码与复制" : "QR code & copy")
                      : channel.type === "whatsapp"
                        ? (zh ? "WhatsApp 直接跳转" : "WhatsApp direct link")
                        : (zh ? "QQ 客户端跳转" : "QQ app link")}
                  </strong>
                  <small>
                    {isWechat
                      ? (zh ? "不显示“打开微信”按钮" : "No “Open WeChat” action")
                      : channel.type === "qq"
                        ? (zh ? "保留复制账号降级入口" : "Copy fallback remains available")
                        : (zh ? "自动带入预设咨询消息" : "Prefills the support message")}
                  </small>
                </span>
              </div>
              <button><PencilSimple size={16} />{zh ? "编辑" : "Edit"}</button>
            </article>
          );
        })}
      </div>
    </>
  );
}

function CurrenciesPage({ lang }) {
  const zh = lang === "zh";
  const [selectedCode, setSelectedCode] = useState("MYR");
  const selected = currencies.find((item) => item.code === selectedCode);
  return (
    <>
      <AdminSurfaceToolbar
        summary={zh ? "全部汇率有效 · 最近更新 4 分钟前" : "All rates valid · updated 4 min ago"}
        action={<button className="toolbar-action"><ArrowsClockwise size={17} />{zh ? "更新汇率" : "Refresh rates"}</button>}
      />
      <section className="rate-health">
        <div><Pulse size={21} /><span><strong>{zh ? "法币汇率" : "Fiat rates"}</strong><small>{zh ? "30 分钟前更新" : "Updated 30 min ago"}</small></span><StatusPill status="completed" lang={lang} /></div>
        <div><CurrencyCircleDollar size={21} /><span><strong>USDT</strong><small>1 CNY = 0.1397 USDT</small></span><StatusPill status="completed" lang={lang} /></div>
        <div><Database size={21} /><span><strong>{zh ? "备用数据" : "Fallback data"}</strong><small>{zh ? "最后有效快照可用" : "Last valid snapshot ready"}</small></span><StatusPill status="completed" lang={lang} /></div>
      </section>
      <div className="currency-workbench">
        <section className="admin-panel currency-admin-table admin-data-scroll">
          <div className="currency-table-header">
            <span>{zh ? "标识" : "Token"}</span>
            <span>{zh ? "代码" : "Code"}</span>
            <span>{zh ? "名称" : "Name"}</span>
            <span>{zh ? "当前汇率" : "Current rate"}</span>
            <span>{zh ? "精度" : "Precision"}</span>
            <span>{zh ? "状态" : "Status"}</span>
            <span>{zh ? "操作" : "Action"}</span>
          </div>
          {currencies.map((currency) => (
            <button className={selectedCode === currency.code ? "is-selected" : ""} onClick={() => setSelectedCode(currency.code)} key={currency.code}>
              <CurrencyToken currency={currency} />
              <strong>{currency.code}</strong>
              <span title={currency.name[lang]}>{currency.name[lang]}</span>
              <em>1 CNY = {(currency.rate / 1.62).toFixed(currency.digits === 0 ? 2 : 4)}</em>
              <small>{currency.digits} {zh ? "位小数" : "decimals"}</small>
              <StatusPill status="completed" lang={lang} />
              <CaretRight size={16} />
            </button>
          ))}
        </section>
        <aside className="currency-detail admin-panel">
          <CurrencyToken currency={selected} />
          <small>{selected.name[lang]}</small>
          <h2>{selected.code}</h2>
          <p>{zh ? "当前为自动汇率。手动覆盖会写入审计日志，并要求填写修改原因。" : "This currency uses the automatic rate. Manual overrides are audited and require a reason."}</p>
          <dl><div><dt>{zh ? "当前汇率" : "Current rate"}</dt><dd>1 CNY = {(selected.rate / 1.62).toFixed(selected.digits === 0 ? 2 : 4)}</dd></div><div><dt>{zh ? "小数位" : "Decimals"}</dt><dd>{selected.digits}</dd></div><div><dt>{zh ? "前台显示" : "Storefront"}</dt><dd>{zh ? "已启用" : "Enabled"}</dd></div><div><dt>{zh ? "在线支付" : "Online payment"}</dt><dd>{zh ? "未启用" : "Disabled"}</dd></div></dl>
          <button className="admin-secondary"><PencilSimple size={17} />{zh ? "编辑币种规则" : "Edit currency rules"}</button>
        </aside>
      </div>
    </>
  );
}

function TeamPage({ lang }) {
  const zh = lang === "zh";
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = teamMembers[selectedIndex];
  return (
    <>
      <AdminSurfaceToolbar
        summary={zh ? `${teamMembers.length} 名员工 · 3 人在线` : `${teamMembers.length} members · 3 online`}
        action={<button className="toolbar-primary"><UserPlus size={17} />{zh ? "邀请员工" : "Invite member"}</button>}
      />
      <div className="team-workbench">
        <section className="team-list admin-panel admin-data-scroll">
          <div className="team-list__header"><span>{zh ? "员工" : "Member"}</span><span>{zh ? "邮箱" : "Email"}</span><span>{zh ? "角色" : "Role"}</span><span>{zh ? "工作组" : "Group"}</span><span>{zh ? "安全" : "Security"}</span><span>{zh ? "状态" : "Status"}</span><span>{zh ? "最后活动" : "Last active"}</span><span>{zh ? "操作" : "Action"}</span></div>
          {teamMembers.map((member, index) => (
            <button className={selectedIndex === index ? "is-selected" : ""} key={member.email} onClick={() => setSelectedIndex(index)}>
              <span className="member-name"><span className="member-avatar">{member.name[lang][0]}</span><strong title={member.name[lang]}>{member.name[lang]}</strong></span>
              <span title={member.email}>{member.email}</span>
              <span title={member.role[lang]}>{member.role[lang]}</span>
              <span title={member.group[lang]}>{member.group[lang]}</span>
              <span className="member-security"><i className={member.twoFactor ? "enabled" : ""} />{member.twoFactor ? (zh ? "2FA 已启用" : "2FA enabled") : (zh ? "2FA 未启用" : "2FA disabled")}</span>
              <strong className={member.status === "online" ? "member-online" : ""}>{member.status === "online" ? (zh ? "在线" : "Online") : (zh ? "离线" : "Offline")}</strong>
              <time>{formatTableDateTime(member.lastActiveAt)}</time>
              <CaretRight size={16} />
            </button>
          ))}
        </section>
        <aside className="team-detail admin-panel">
          <div className="team-detail__profile"><span className="member-avatar large">{selected.name[lang][0]}</span><div><small>{selected.role[lang]}</small><h2>{selected.name[lang]}</h2><p>{selected.email}</p></div></div>
          <dl>
            <div><dt>{zh ? "数据范围" : "Data scope"}</dt><dd>{selectedIndex === 0 ? (zh ? "全部数据" : "All data") : (zh ? "所属工作组" : "Assigned group")}</dd></div>
            <div><dt>{zh ? "两步验证" : "Two-step verification"}</dt><dd>{selected.twoFactor ? (zh ? "已启用" : "Enabled") : (zh ? "未启用" : "Not enabled")}</dd></div>
            <div><dt>{zh ? "当前会话" : "Active sessions"}</dt><dd>{selected.sessions}</dd></div>
            <div><dt>{zh ? "账号状态" : "Account status"}</dt><dd>{zh ? "正常" : "Active"}</dd></div>
          </dl>
          <div className="team-detail__actions"><button className="admin-secondary">{zh ? "查看会话" : "View sessions"}</button><button className="admin-primary">{zh ? "编辑权限" : "Edit access"}</button></div>
        </aside>
      </div>
    </>
  );
}

function RolesPage({ lang }) {
  const zh = lang === "zh";
  const roles = [
    { title: zh ? "超级管理员" : "Super admin", description: zh ? "所有权限与全部数据" : "All permissions and data", people: 1, scope: zh ? "全部数据" : "All data", grants: [true, true, true, true, true] },
    { title: zh ? "运营管理员" : "Operations manager", description: zh ? "商品、订单与人员调度" : "Products, orders and assignment", people: 2, scope: zh ? "全部订单" : "All orders", grants: [true, true, true, false, true] },
    { title: zh ? "订单客服" : "Order support", description: zh ? "被分配订单与联系方式" : "Assigned orders and contacts", people: 4, scope: zh ? "分配给自己" : "Assigned only", grants: [true, false, true, false, false] },
    { title: zh ? "内容编辑" : "Content editor", description: zh ? "商品、轮播与双语言内容" : "Products, stories and bilingual copy", people: 2, scope: zh ? "内容数据" : "Content data", grants: [false, true, false, false, false] },
    { title: zh ? "财务审核" : "Finance reviewer", description: zh ? "付款状态、退款与金额" : "Payment, refund and amounts", people: 1, scope: zh ? "全部订单" : "All orders", grants: [true, false, false, true, false] },
    { title: zh ? "审计只读" : "Audit viewer", description: zh ? "只读数据与日志" : "Read-only data and logs", people: 1, scope: zh ? "只读" : "Read only", grants: [true, true, false, false, true] },
  ];
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = roles[selectedIndex];
  const permissions = zh ? ["查看订单", "编辑商品", "揭示联系方式", "确认付款", "查看日志"] : ["View orders", "Edit products", "Reveal contacts", "Confirm payment", "View logs"];
  return (
    <>
      <AdminSurfaceToolbar
        summary={zh ? `${roles.length} 个角色 · 按操作与数据范围授权` : `${roles.length} roles · action and data scopes`}
        action={<button className="toolbar-primary"><Key size={17} />{zh ? "新建角色" : "New role"}</button>}
      />
      <div className="roles-workbench">
        <section className="role-list admin-panel">
          {roles.map((role, index) => (
            <button className={selectedIndex === index ? "is-selected" : ""} key={role.title} onClick={() => setSelectedIndex(index)}>
              <span>0{index + 1}</span>
              <div><strong>{role.title}</strong><small>{role.description}</small></div>
              <em><UsersThree size={15} />{role.people}</em>
              <CaretRight size={16} />
            </button>
          ))}
        </section>
        <section className="permission-matrix admin-panel">
          <div className="permission-matrix__heading"><div><small>{zh ? "当前角色" : "Selected role"}</small><h2>{selected.title}</h2><p>{selected.description}</p></div><button className="admin-primary">{zh ? "编辑角色" : "Edit role"}</button></div>
          <div className="permission-scope"><span>{zh ? "数据范围" : "Data scope"}</span><strong>{selected.scope}</strong></div>
          <div className="permission-list">
            {permissions.map((permission, index) => <div key={permission}><span>{permission}</span><em className={selected.grants[index] ? "granted" : ""}>{selected.grants[index] ? (zh ? "允许" : "Allowed") : (zh ? "不允许" : "Denied")}</em></div>)}
          </div>
        </section>
      </div>
    </>
  );
}

function LogsPage({ lang }) {
  const zh = lang === "zh";
  return (
    <>
      <div className="log-toolbar">
        <div className="log-tabs"><button className="is-active">{zh ? "操作审计" : "Audit"}</button><button>{zh ? "订单事件" : "Order events"}</button><button>{zh ? "库存流水" : "Inventory"}</button><button>{zh ? "通知发送" : "Notifications"}</button><button>{zh ? "系统任务" : "Jobs"}</button></div>
        <button className="toolbar-action"><DownloadSimple size={17} />{zh ? "导出日志" : "Export log"}</button>
      </div>
      <div className="log-filters">
        <label><MagnifyingGlass size={17} /><input placeholder={zh ? "搜索员工、订单或追踪编号" : "Search actor, order or trace"} /></label>
        <button><SlidersHorizontal size={17} />{zh ? "事件类型" : "Event type"}</button>
        <button><Clock size={17} />{zh ? "最近 24 小时" : "Last 24 hours"}</button>
      </div>
      <div className="admin-panel audit-log admin-data-scroll">
        <div className="audit-log__header"><span>{zh ? "人员" : "Actor"}</span><span>{zh ? "事件" : "Event"}</span><span>{zh ? "设备与追踪" : "Device & trace"}</span><span>{zh ? "时间" : "Time"}</span><span>{zh ? "操作" : "Action"}</span></div>
        {auditEvents.concat(auditEvents.slice(0, 2)).map((event, index) => <div className="audit-log__row" key={`${event.type}-${index}`}><span className="audit-actor"><span className={`audit-node ${event.tone}`} /><span className="audit-avatar">{event.actor[lang][0]}</span><strong title={event.actor[lang]}>{event.actor[lang]}</strong></span><p title={formatAuditEvent(event, lang)}>{formatAuditEvent(event, lang)}</p><small title={`IP 203.0.113.${18 + index} · Chrome / macOS · TRACE-CB-${2600 + index}`}>IP 203.0.113.{18 + index} · Chrome / macOS · TRACE-CB-{2600 + index}</small><time>{formatTableDateTime(event.createdAt)}</time><button aria-label={zh ? "查看日志详情" : "View log detail"}><Eye size={17} /></button></div>)}
      </div>
    </>
  );
}

function SecurityPage({ lang }) {
  const zh = lang === "zh";
  const sessions = [
    { device: "MacBook Pro", meta: { zh: "洛杉矶 · Chrome", en: "Los Angeles · Chrome" }, status: { zh: "当前设备", en: "Current device" } },
    { device: "iPhone 16 Pro", meta: { zh: "吉隆坡 · Safari", en: "Kuala Lumpur · Safari" }, status: { zh: "18 分钟前", en: "18 min ago" } },
    { device: "Windows Desktop", meta: { zh: "新加坡 · Edge", en: "Singapore · Edge" }, status: { zh: "昨天", en: "Yesterday" } },
  ];
  return (
    <>
      <section className="security-hero">
        <div className="security-score"><span>92</span><i>100</i></div>
        <div><h2>{zh ? "整体保护状态良好" : "Strong protection posture"}</h2><p>{zh ? "建议为另外 3 名员工启用两步验证。" : "Enable two-step verification for 3 remaining team members."}</p></div>
        <button className="admin-primary"><ShieldCheck size={18} />{zh ? "查看建议" : "Review actions"}</button>
      </section>
      <div className="security-grid">
        {[["两步验证", "Two-step verification", "1 / 4", ShieldCheck], ["当前会话", "Active sessions", "3", UserCircle], ["登录失败", "Failed sign-ins", "2", WarningCircle], ["权限拒绝", "Access denied", "5", LockKey]].map(([cn, en, value, Glyph]) => <article key={en}><span><Glyph size={22} /></span><div><small>{zh ? cn : en}</small><strong>{value}</strong></div><CaretRight size={16} /></article>)}
      </div>
      <div className="admin-panel sessions-panel"><div className="panel-heading"><h2>{zh ? "当前登录会话" : "Active sessions"}</h2></div>{sessions.map((session) => <div key={session.device}><span><UserCircle size={21} /></span><div><strong>{session.device}</strong><small>{session.meta[lang]}</small></div><em>{session.status[lang]}</em><button>{zh ? "强制退出" : "Sign out"}</button></div>)}</div>
    </>
  );
}

function IntegrationsPage({ lang }) {
  const zh = lang === "zh";
  const stateText = {
    healthy: { zh: "正常", en: "Healthy" },
    degraded: { zh: "降级", en: "Degraded" },
    notConnected: { zh: "未连接", en: "Not connected" },
  };
  const services = [
    { title: zh ? "数据库" : "Database", description: zh ? "主数据服务" : "Primary data service", status: "healthy", value: "99.99%", Glyph: Database },
    { title: zh ? "对象存储" : "Object storage", description: zh ? "图片与媒体资源" : "Images and media", status: "healthy", Glyph: CloudArrowUp },
    { title: zh ? "邮件服务" : "Email service", description: zh ? "订单与系统通知" : "Order and system delivery", status: "degraded", Glyph: EnvelopeSimple },
    { title: zh ? "法币汇率" : "Fiat rate provider", description: zh ? "每 30 分钟同步" : "30 min refresh", status: "healthy", Glyph: ArrowsClockwise },
    { title: "USDT", description: zh ? "独立报价服务" : "Independent quote service", status: "healthy", Glyph: CurrencyCircleDollar },
    { title: zh ? "支付平台" : "Payment platform", description: zh ? "未来在线支付预留" : "Reserved for future payments", status: "notConnected", Glyph: PlugsConnected },
    { title: zh ? "Telegram 机器人" : "Telegram bot", description: zh ? "新订单管理群通知" : "New-order admin group alerts", status: "notConnected", Glyph: TelegramLogo },
  ];
  return (
    <>
      <AdminSurfaceToolbar
        summary={zh ? "4 项正常 · 1 项降级 · 2 项未连接" : "4 healthy · 1 degraded · 2 not connected"}
        action={<button className="toolbar-action"><Pulse size={17} />{zh ? "健康检查" : "Health check"}</button>}
      />
      <div className="integration-grid">{services.map(({ title, description, status, value, Glyph }) => <article key={title}><span className="integration-glyph"><Glyph size={23} /></span><div><h3>{title}</h3><p>{description}</p></div><em className={status === "degraded" ? "warn" : status === "notConnected" ? "muted" : ""}><i />{value || stateText[status][lang]}</em><button aria-label={zh ? `打开${title}详情` : `Open ${title} details`}><CaretRight size={16} /></button></article>)}</div>
      <div className="admin-panel jobs-panel"><div className="panel-heading"><h2>{zh ? "后台任务" : "Background jobs"}</h2></div>{[["法币汇率更新", "Fiat rate refresh", "11:30", "成功"], ["过期订单释放库存", "Release expired inventory", "11:25", "成功"], ["邮件通知重试", "Retry email notifications", "11:20", "警告"], ["每日数据备份", "Daily database backup", "04:00", "成功"]].map(([cn, en, time, status]) => <div key={en}><span className={`job-node ${status === "警告" ? "warn" : ""}`} /><div><strong>{zh ? cn : en}</strong><small>TRACE-CB-JOB-{time.replace(":", "")}</small></div><time>{time}</time><em>{status === "成功" ? (zh ? "已完成" : "Completed") : (zh ? "待重试" : "Retrying")}</em></div>)}</div>
    </>
  );
}

function SettingsPage({
  lang,
  transitServiceConfig,
  onSaveTransitService,
  notify,
}) {
  const zh = lang === "zh";
  const [draft, setDraft] = useState(() => ({ ...transitServiceConfig }));
  const [attempted, setAttempted] = useState(false);
  const [touched, setTouched] = useState(false);
  const [saveState, setSaveState] = useState("idle");
  const urlInputRef = useRef(null);
  useEffect(() => {
    setDraft({ ...transitServiceConfig });
  }, [transitServiceConfig]);
  const trimmedUrl = draft.url.trim();
  const normalizedUrl = normalizeTransitServiceUrl(trimmedUrl);
  const urlError = trimmedUrl && !normalizedUrl
    ? (zh ? "请输入完整的 HTTPS 网址，且不能包含账号或密码。" : "Enter a complete HTTPS URL without embedded credentials.")
    : "";
  const showUrlError = Boolean(urlError && (attempted || touched));
  const persistedUrl = transitServiceConfig.url || "";
  const isDirty = draft.enabled !== transitServiceConfig.enabled || draft.url !== persistedUrl;
  const previewConfig = {
    enabled: draft.enabled,
    url: normalizedUrl,
  };
  const setDraftValue = (nextDraft) => {
    setDraft(nextDraft);
    setSaveState("idle");
  };
  const saveSettings = () => {
    setAttempted(true);
    if (urlError) {
      setSaveState("invalid");
      requestAnimationFrame(() => urlInputRef.current?.focus());
      return;
    }
    const nextConfig = {
      enabled: draft.enabled,
      url: normalizedUrl,
    };
    if (!onSaveTransitService(nextConfig)) {
      setSaveState("error");
      notify({ type: "error", message: zh ? "入口设置保存失败" : "Could not save the entry settings" });
      return;
    }
    setDraft(nextConfig);
    setAttempted(false);
    setTouched(false);
    setSaveState("saved");
    notify({ type: "success", message: zh ? "中转站入口已保存" : "Transit Service entry saved" });
  };
  const summary = saveState === "saved"
    ? (zh ? "中转站入口设置已保存到本地预览" : "Transit Service entry saved to this local preview")
    : saveState === "error"
      ? (zh ? "保存失败，请检查浏览器存储权限" : "Save failed. Check browser storage permissions")
      : saveState === "invalid"
        ? (zh ? "请先修正网址" : "Fix the URL before saving")
        : isDirty
          ? (zh ? "入口设置有未保存的更改" : "Entry settings have unsaved changes")
          : (zh ? "当前为本地演示配置" : "Local demonstration settings");
  return (
    <>
      <AdminSurfaceToolbar
        summary={summary}
        action={<button type="button" className="toolbar-primary" onClick={saveSettings}><Check size={17} />{saveState === "saved" && !isDirty ? (zh ? "已保存" : "Saved") : (zh ? "保存入口设置" : "Save entry")}</button>}
      />
      <div className="settings-layout">
        <nav><button className="is-active">{zh ? "品牌与基础" : "Brand & basics"}</button><button>{zh ? "订单设置" : "Order settings"}</button><button>{zh ? "通知设置" : "Notifications"}</button><button>{zh ? "政策内容" : "Policies"}</button><button>{zh ? "高级设置" : "Advanced"}</button></nav>
        <div className="settings-form admin-panel">
          <div className="setting-group"><h2>{zh ? "品牌与基础信息" : "Brand and basics"}</h2><p>{zh ? "这些内容会出现在客户端页头、页脚与页面元信息中。" : "Used in the storefront header, footer and page metadata."}</p></div>
          <label><span>{zh ? "网站名称" : "Site name"}</span><input defaultValue={copy[lang].brandName} /></label>
          <label><span>{zh ? "网站定位" : "Tagline"}</span><input defaultValue={zh ? "连接全球 AI 服务" : "Connecting global AI services"} /></label>
          <div className="field-row"><label><span>{zh ? "默认语言" : "Default language"}</span><select defaultValue="zh"><option value="zh">{zh ? "简体中文" : "Simplified Chinese"}</option><option value="en">{zh ? "英文" : "English"}</option></select></label><label><span>{zh ? "默认币种" : "Default currency"}</span><select defaultValue="MYR"><option>MYR</option><option>CNY</option><option>USD</option></select></label></div>
          <div className="setting-toggle"><div><strong>{zh ? "允许接收新订单" : "Accept new orders"}</strong><small>{zh ? "关闭后商品仍可浏览，但不能提交订单。" : "Products remain visible, but checkout is disabled."}</small></div><button className="switch is-on"><i /></button></div>
          <div className="setting-toggle"><div><strong>{zh ? "悬浮客服入口" : "Floating support access"}</strong><small>{zh ? "在客户端页面右下方显示快速联系入口。" : "Show a quick support access on storefront pages."}</small></div><button className="switch is-on"><i /></button></div>
          <section className="transit-service-settings" aria-labelledby="transit-service-settings-title">
            <div className="setting-group">
              <span className="transit-service-settings__eyebrow">{zh ? "外部服务入口" : "External service entry"}</span>
              <h2 id="transit-service-settings-title">{zh ? "中转站服务" : "Transit Service"}</h2>
              <p>{zh ? "为客户端配置一个独立的外部服务入口。它与人工客服入口互不影响。" : "Configure a separate external service destination. It remains independent from support access."}</p>
            </div>
            <div className="setting-toggle transit-service-settings__toggle">
              <div>
                <strong>{zh ? "显示悬浮入口" : "Show floating entry"}</strong>
                <small>{zh ? "未填写网址时仍会显示入口，点击后提示尚未配置。" : "Without a URL, the entry remains visible and explains that it is not configured."}</small>
              </div>
              <button
                type="button"
                className={`switch ${draft.enabled ? "is-on" : ""}`}
                aria-pressed={draft.enabled}
                aria-label={zh ? "显示中转站服务入口" : "Show Transit Service entry"}
                onClick={() => setDraftValue({ ...draft, enabled: !draft.enabled })}
              >
                <i />
              </button>
            </div>
            <label className={showUrlError ? "has-error" : ""}>
              <span>{zh ? "跳转网址" : "Destination URL"}</span>
              <input
                ref={urlInputRef}
                type="url"
                inputMode="url"
                autoComplete="url"
                spellCheck="false"
                value={draft.url}
                placeholder="https://example.com"
                aria-invalid={showUrlError}
                aria-describedby="transit-service-url-help transit-service-url-error"
                onBlur={() => setTouched(true)}
                onChange={(event) => setDraftValue({ ...draft, url: event.target.value })}
              />
              <small id="transit-service-url-help">{zh ? "可以暂时留空；填写时仅支持 HTTPS，且不能包含账号或密码。" : "You may leave this empty. When set, HTTPS is required and embedded credentials are rejected."}</small>
              <small id="transit-service-url-error" className="settings-field-error" aria-live="polite">{showUrlError ? urlError : ""}</small>
            </label>
            <div className="transit-service-settings__actions">
              {validateTransitServiceUrl(draft.url) ? (
                <a className="admin-secondary" href={normalizedUrl} target="_blank" rel="noopener noreferrer">
                  <ArrowSquareOut size={16} />
                  {zh ? "测试链接" : "Test link"}
                </a>
              ) : (
                <button type="button" className="admin-secondary" disabled>
                  <ArrowSquareOut size={16} />
                  {zh ? "测试链接" : "Test link"}
                </button>
              )}
              <span>{draft.enabled ? (normalizedUrl ? (zh ? "保存后点击可跳转" : "Opens the destination after saving") : (zh ? "保存后显示，点击会提示未配置" : "Visible after saving; clicking shows an unconfigured notice")) : (zh ? "当前关闭，客户端不会显示" : "Currently hidden from the storefront")}</span>
            </div>
          </section>
        </div>
        <aside className="settings-context-panel">
          <div className="settings-preview-brand"><BrandMark size="preview" /><div><strong>{copy[lang].brandName}</strong></div></div>
          <div className="transit-service-preview">
            <span>{zh ? "入口预览" : "Entry preview"}</span>
            <TransitServiceLink config={previewConfig} lang={lang} preview />
            <small>{!previewConfig.enabled ? (zh ? "入口当前隐藏" : "Entry currently hidden") : normalizedUrl ? (zh ? "有效网址 · 点击可跳转" : "Valid URL · ready to open") : (zh ? "未配置网址 · 点击显示提示" : "No URL · clicking shows a notice")}</small>
          </div>
          <h2>{zh ? "影响范围" : "Impact preview"}</h2>
          <p>{zh ? "中转站设置只影响客户端右下角的外部入口，不会覆盖人工客服。" : "Transit Service settings affect only the external bottom-right entry and never replace support."}</p>
          <dl><div><dt>{zh ? "发布状态" : "Publish state"}</dt><dd>{zh ? "仅本地预览" : "Local preview only"}</dd></div><div><dt>{zh ? "最近修改" : "Last modified"}</dt><dd>{zh ? "王朝 · 8 分钟前" : "Wang Chao · 8 min ago"}</dd></div></dl>
          <div className="settings-context-note"><WarningCircle size={17} /><span>{zh ? "当前是本地原型配置，不代表生产网站已接通该网址。" : "This is local prototype configuration and does not prove the production site is connected."}</span></div>
        </aside>
      </div>
    </>
  );
}

function NotificationsPage({ lang }) {
  const zh = lang === "zh";
  const notificationTypeText = {
    order: { zh: "订单", en: "ORDER" },
    inventory: { zh: "库存", en: "INVENTORY" },
    system: { zh: "系统", en: "SYSTEM" },
    rate: { zh: "汇率", en: "RATE" },
  };
  const notifications = [
    { id: "order", title: { zh: "新订单等待领取", en: "New order awaiting assignment" }, text: { zh: `订单 ${mockOrders[0].id} · OpenAI Codex · RM 89.00`, en: `Order ${mockOrders[0].id} · OpenAI Codex · RM 89.00` }, detail: { zh: "订单已成功占用库存，尚未分配客服。建议在 10 分钟内领取并联系客户。", en: "Inventory is reserved and no support owner is assigned. Claim the order and contact the customer within 10 minutes." }, type: "order", tone: "new", unread: true, Glyph: Receipt },
    { id: "stock", title: { zh: "Claude Pro 库存较低", en: "Claude Pro inventory is low" }, text: { zh: "可用库存仅余 3 件，请检查是否需要补充。", en: "Only 3 units remain. Review replenishment." }, detail: { zh: "此提醒来自低库存阈值。商品仍可正常下单，但建议尽快确认库存安排。", en: "This alert was triggered by the low-stock threshold. Ordering remains available, but inventory should be reviewed." }, type: "inventory", tone: "warning", unread: false, Glyph: WarningCircle },
    { id: "email", title: { zh: "邮件通知发送失败", en: "Email notification failed" }, text: { zh: "2 条新订单邮件发送失败，系统将在 5 分钟后重试。", en: "Two order emails failed. The system will retry in 5 minutes." }, detail: { zh: "订单已正常保存，本次异常只影响邮件通知。可在通知日志中查看错误与重试次数。", en: "Orders were saved successfully. Only email delivery is affected. Review the notification log for the error and retry count." }, type: "system", tone: "danger", unread: true, Glyph: EnvelopeSimple },
    { id: "rates", title: { zh: "法币汇率更新完成", en: "Fiat rates updated" }, text: { zh: "23 个币种已更新，所有汇率均处于有效期内。", en: "Rates for 23 currencies were refreshed and remain valid." }, detail: { zh: "主汇率源返回正常，备用快照已同步。当前没有需要人工处理的过期汇率。", en: "The primary source is healthy and the fallback snapshot is synchronized. No expired rates need attention." }, type: "rate", tone: "success", unread: false, Glyph: ArrowsClockwise },
  ];
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState("order");
  const visible = filter === "all" ? notifications : notifications.filter((item) => item.unread);
  const selected = notifications.find((item) => item.id === selectedId) || visible[0];
  const SelectedGlyph = selected.Glyph;
  return (
    <div className="notification-workbench">
      <section className="notification-list-panel admin-panel">
        <div className="notification-list-toolbar">
          <div className="filter-tabs">
            <button className={filter === "all" ? "is-active" : ""} onClick={() => setFilter("all")}>{zh ? "全部" : "All"}</button>
            <button className={filter === "unread" ? "is-active" : ""} onClick={() => setFilter("unread")}>{zh ? "未读 2" : "Unread 2"}</button>
          </div>
          <button className="mark-read-action"><Check size={16} />{zh ? "全部已读" : "Mark read"}</button>
        </div>
        <div className="notification-inbox">
          {visible.map((item, index) => {
            const Glyph = item.Glyph;
            return (
              <button key={item.id} className={`${item.unread ? "is-unread" : ""} ${selected?.id === item.id ? "is-selected" : ""}`} onClick={() => setSelectedId(item.id)}>
                <span className={`notification-glyph ${item.tone}`}><Glyph size={20} /></span>
                <div><strong>{item.title[lang]}</strong><p>{item.text[lang]}</p><small>{index === 0 ? (zh ? "刚刚" : "Just now") : `${index * 12} ${zh ? "分钟前" : "min ago"}`}</small></div>
                <CaretRight size={16} />
              </button>
            );
          })}
        </div>
      </section>
      <aside className="notification-detail-panel admin-panel">
        <div className={`notification-detail-icon ${selected.tone}`}><SelectedGlyph size={25} /></div>
        <small>{notificationTypeText[selected.type][lang]} · TRACE-CB-NTF-{selected.id.toUpperCase()}</small>
        <h2>{selected.title[lang]}</h2>
        <p>{selected.detail[lang]}</p>
        <dl>
          <div><dt>{zh ? "状态" : "Status"}</dt><dd>{selected.unread ? (zh ? "未读" : "Unread") : (zh ? "已读" : "Read")}</dd></div>
          <div><dt>{zh ? "渠道" : "Channel"}</dt><dd>{zh ? "站内通知" : "In-app notification"}</dd></div>
          <div><dt>{zh ? "产生时间" : "Created"}</dt><dd>{formatDateTime("2026-07-27T14:32:00-07:00", lang)}</dd></div>
        </dl>
        <div className="notification-detail-actions">
          <button className="admin-secondary">{zh ? "查看相关记录" : "Open related record"}</button>
          <button className="admin-primary"><Check size={17} />{zh ? "标记已处理" : "Mark resolved"}</button>
        </div>
      </aside>
    </div>
  );
}

function GenericAdminPage({
  page,
  lang,
  onSensitiveAction,
  transitServiceConfig,
  onSaveTransitService,
  notify,
  googleAuthenticatorEnabled,
  onGoogleAuthenticatorToggle,
}) {
  if (page === "banners") return <BannersPage lang={lang} />;
  if (page === "media") return <MediaPage lang={lang} />;
  if (page === "translations") return <TranslationPage lang={lang} />;
  if (page === "contacts") return <ContactsPage lang={lang} />;
  if (page === "currencies") return <CurrenciesPage lang={lang} />;
  if (page === "notifications") return <NotificationsPage lang={lang} />;
  if (page === "telegram-bot") return <TelegramBotPage lang={lang} onSensitiveAction={onSensitiveAction} />;
  if (page === "team") return <TeamPage lang={lang} />;
  if (page === "roles") return <RolesPage lang={lang} />;
  if (page === "logs") return <LogsPage lang={lang} />;
  if (page === "payments") return <PaymentsPage lang={lang} onSensitiveAction={onSensitiveAction} />;
  if (page === "reconciliation") return <ReconciliationPage lang={lang} />;
  if (page === "disputes") return <DisputesPage lang={lang} onSensitiveAction={onSensitiveAction} />;
  if (page === "security") {
    return (
      <SecurityDesignPage
        lang={lang}
        googleAuthenticatorEnabled={googleAuthenticatorEnabled}
        onGoogleAuthenticatorToggle={onGoogleAuthenticatorToggle}
      />
    );
  }
  if (page === "security-events") return <SecurityEventsPage lang={lang} onSensitiveAction={onSensitiveAction} />;
  if (page === "data-security") return <DataSecurityPage lang={lang} onSensitiveAction={onSensitiveAction} />;
  if (page === "backups") return <BackupsPage lang={lang} onSensitiveAction={onSensitiveAction} />;
  if (page === "secrets") return <SecretsPage lang={lang} onSensitiveAction={onSensitiveAction} />;
  if (page === "integrations") return <IntegrationsPage lang={lang} />;
  return (
    <SettingsPage
      lang={lang}
      transitServiceConfig={transitServiceConfig}
      onSaveTransitService={onSaveTransitService}
      notify={notify}
    />
  );
}

function OrderDrawer({ order, onClose, lang, onRequestReauth }) {
  const [status, setStatus] = useState(order?.status || "new");
  const [payment, setPayment] = useState(order?.payment || "unpaid");
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setStatus(order?.status || "new");
    setPayment(order?.payment || "unpaid");
    setRevealed(false);
    setCopied(false);
  }, [order]);
  if (!order) return null;
  const zh = lang === "zh";
  const ChannelGlyph = order.channel === "WhatsApp" ? WhatsappLogo : order.channel === "WeChat" ? WechatLogo : ChatsCircle;
  const copyContact = async () => {
    if (!revealed) return;
    await navigator.clipboard?.writeText(order.fullContact);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };
  return (
    <Modal open={Boolean(order)} onClose={onClose} className="admin-detail-drawer" label={zh ? `订单详情 ${order.id}` : `Order detail ${order.id}`}>
      <DrawerHeader title={order.id} subtitle={zh ? "订单详情" : "Order detail"} onClose={onClose} lang={lang} />
      <div className="order-drawer-summary">
        <div><small>{zh ? "商品" : "Product"}</small><strong>{order.product}</strong></div>
        <div><small>{zh ? "应付金额" : "Amount"}</small><strong>{order.amount}</strong><span>{order.usdt}</span></div>
      </div>
      <section className="drawer-section">
        <div className="drawer-section__heading"><h3>{zh ? "客户联系方式" : "Customer contact"}</h3><span><Eye size={15} />{zh ? "揭示操作会写入审计日志" : "Reveal is audited"}</span></div>
        <div className="sensitive-contact">
          <span className={`channel-icon ${order.channel.toLowerCase()}`}><ChannelGlyph size={21} /></span>
          <div><small>{getChannelLabel(order.channel, lang)}</small><strong>{revealed ? order.fullContact : order.contact}</strong></div>
          {!revealed
            ? <button className="reveal-contact" onClick={() => onRequestReauth({
              title: zh ? "揭示完整联系方式" : "Reveal full contact",
              description: zh ? "请重新验证并说明查看原因。成功后将记录人员、时间、订单和当前设备。" : "Re-verify and state a reason. The operator, time, order and current device will be recorded.",
              requireReason: true,
              onConfirm: () => setRevealed(true),
            })}><Eye size={17} />{zh ? "揭示" : "Reveal"}</button>
            : <button className="copy-contact" onClick={copyContact}>{copied ? <Check size={17} /> : <Copy size={17} />}{copied ? (zh ? "已复制" : "Copied") : (zh ? "复制" : "Copy")}</button>}
        </div>
      </section>
      <section className="drawer-section">
        <div className="drawer-section__heading"><h3>{zh ? "处理状态" : "Order status"}</h3></div>
        <div className="status-selector">{["manualPending", "contacted", "awaitingPayment", "paymentProcessing", "paid", "fulfilling", "completed", "cancelled", "refundPending", "refunded", "disputed"].map((item) => <button className={status === item ? "is-active" : ""} onClick={() => setStatus(item)} key={item}><i />{statusText[item][lang]}</button>)}</div>
      </section>
      <section className="drawer-section">
        <div className="drawer-section__heading"><h3>{zh ? "付款状态" : "Payment status"}</h3><span>{zh ? "与处理状态独立保存" : "Saved separately from order status"}</span></div>
        <div className="status-selector payment-selector">{["unpaid", "pending", "paid", "failed", "refundPending", "refunded", "disputed"].map((item) => <button className={payment === item ? "is-active" : ""} onClick={() => setPayment(item)} key={item}><i />{statusText[item][lang]}</button>)}</div>
      </section>
      <section className="drawer-section">
        <div className="drawer-section__heading"><h3>{zh ? "事件时间线" : "Event timeline"}</h3></div>
        <div className="drawer-timeline"><div><i /><span><strong>{zh ? "订单创建并占用库存" : "Order created and inventory reserved"}</strong><small>14:32 · {zh ? "系统" : "SYSTEM"}</small></span></div><div><i /><span><strong>{zh ? "后台通知已生成" : "Console notification created"}</strong><small>14:32 · {zh ? "系统" : "SYSTEM"}</small></span></div><div className="active"><i /><span><strong>{zh ? "等待员工领取" : "Awaiting assignment"}</strong><small>{zh ? "当前" : "NOW"}</small></span></div></div>
      </section>
      <label className="drawer-note"><span>{zh ? "内部备注" : "Internal note"}</span><textarea placeholder={zh ? "仅后台员工可见…" : "Visible to staff only…"} /></label>
      <div className="drawer-actions"><button className="admin-secondary" disabled={!revealed}><ChannelGlyph size={18} />{revealed ? (zh ? "联系客户" : "Contact customer") : (zh ? "先揭示联系方式" : "Reveal contact first")}</button><button className="admin-primary" onClick={onClose}><Check size={18} />{zh ? "保存更新" : "Save changes"}</button></div>
    </Modal>
  );
}

function ReauthModal({ action, onClose, lang }) {
  const zh = lang === "zh";
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    setReason("");
    setCode("");
    setConfirmed(false);
  }, [action]);
  if (!action) return null;
  const canContinue = /^\d{6}$/u.test(code) && (!action.requireReason || reason.trim().length >= 4) && confirmed;
  return (
    <Modal open={Boolean(action)} onClose={onClose} className="reauth-dialog" label={action.title}>
      <DrawerHeader title={action.title} subtitle={zh ? "敏感操作保护" : "Sensitive action protection"} onClose={onClose} lang={lang} />
      <div className="reauth-intro"><span><LockKey size={23} /></span><div><strong>{zh ? "需要重新验证当前身份" : "Re-verify your current identity"}</strong><p>{action.description}</p></div></div>
      {action.requireReason && (
        <label className="reauth-field">
          <span>{zh ? "操作原因（写入审计日志）" : "Reason (written to the audit trail)"}</span>
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder={zh ? "说明本次操作的业务原因…" : "Explain the business reason for this action…"} />
        </label>
      )}
      <label className="reauth-field">
        <span>{zh ? "Google Authenticator 6 位动态码" : "Google Authenticator 6-digit code"}</span>
        <div><Key size={18} /><input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/gu, "").slice(0, 6))} autoComplete="one-time-code" inputMode="numeric" pattern="\d{6}" maxLength={6} placeholder="000 000" /></div>
      </label>
      <label className="reauth-confirm">
        <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
        <span>{zh ? "我理解此操作会影响敏感数据、权限或资金，并会生成审计记录。" : "I understand this affects sensitive data, access or funds and creates an audit event."}</span>
      </label>
      <div className="reauth-audit-note"><ShieldCheck size={17} /><span>{zh ? "记录：人员、时间、设备、目标、原因和结果" : "Recorded: operator, time, device, target, reason and result"}</span></div>
      <div className="drawer-actions">
        <button className="admin-secondary" onClick={onClose}>{zh ? "取消" : "Cancel"}</button>
        <button
          className="admin-primary"
          disabled={!canContinue}
          onClick={() => {
            action.onConfirm?.();
            onClose();
          }}
        >
          <ShieldCheck size={17} />{zh ? "验证并继续" : "Verify and continue"}
        </button>
      </div>
    </Modal>
  );
}

function CategoryDrawer({ category, onClose, onSave, lang }) {
  const zh = lang === "zh";
  const [zhName, setZhName] = useState(category?.name?.zh || "");
  const [enName, setEnName] = useState(category?.name?.en || "");
  const [active, setActive] = useState(category?.active ?? true);
  useEffect(() => {
    setZhName(category?.name?.zh || "");
    setEnName(category?.name?.en || "");
    setActive(category?.active ?? true);
  }, [category]);
  if (!category) return null;
  const canSave = Boolean(zhName.trim() && enName.trim());
  return (
    <Modal open={Boolean(category)} onClose={onClose} className="category-edit-drawer" label={zh ? "设置商品分类" : "Configure product category"}>
      <DrawerHeader
        title={category.id ? (zh ? "编辑分类" : "Edit category") : (zh ? "新增分类" : "New category")}
        subtitle={zh ? "商品分类" : "Product category"}
        onClose={onClose}
        lang={lang}
      />
      <div className="category-editor">
        <p>{zh ? "分类名称将直接显示在客户端筛选导航中。" : "Category names appear directly in the storefront filters."}</p>
        <label><span>{zh ? "中文名称" : "Chinese name"}</span><input value={zhName} onChange={(event) => setZhName(event.target.value)} placeholder={zh ? "例如：编码开发" : "For example: 编码开发"} /></label>
        <label><span>{zh ? "英文名称" : "English name"}</span><input value={enName} onChange={(event) => setEnName(event.target.value)} placeholder="For example: Coding & development" /></label>
        <label className="category-visibility">
          <span><strong>{zh ? "客户端显示" : "Storefront visibility"}</strong><small>{zh ? "关闭后，该分类不会出现在客户端导航中。" : "When hidden, this category is removed from storefront navigation."}</small></span>
          <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
        </label>
      </div>
      <div className="drawer-actions">
        <span>{zh ? "中文与英文名称均为必填项" : "Both language names are required"}</span>
        <button className="admin-secondary" onClick={onClose}>{zh ? "取消" : "Cancel"}</button>
        <button
          className="admin-primary"
          disabled={!canSave}
          onClick={() => onSave({
            ...category,
            name: { zh: zhName.trim(), en: enName.trim() },
            active,
          })}
        >
          <Check size={18} />{zh ? "保存分类" : "Save category"}
        </button>
      </div>
    </Modal>
  );
}

function ProductDrawer({ product, onClose, onSaveCategory, categories, lang }) {
  const [title, setTitle] = useState(product?.name?.[lang] || "");
  const [price, setPrice] = useState(product ? (product.price * 1.62).toFixed(2) : "");
  const [categoryId, setCategoryId] = useState(product?.categoryId || "");
  useEffect(() => {
    setTitle(product?.name?.[lang] || "");
    setPrice(product ? (product.price * 1.62).toFixed(2) : "");
    setCategoryId(product?.categoryId || "");
  }, [product, lang]);
  if (!product) return null;
  const zh = lang === "zh";
  return (
    <Modal open={Boolean(product)} onClose={onClose} className="product-edit-drawer" label={zh ? `编辑商品 ${product.name[lang]}` : `Edit product ${product.name[lang]}`}>
      <DrawerHeader title={product.name[lang]} subtitle={zh ? "编辑商品" : "Edit product"} onClose={onClose} lang={lang} />
      <div className="editor-layout">
        <div className="editor-fields">
          <div className="editor-tabs"><button className="is-active">{zh ? "基础与价格" : "Basics & pricing"}</button><button>{zh ? "中文内容" : "Chinese"}</button><button>{zh ? "英文内容" : "English"}</button></div>
          <label><span>{zh ? "商品名称" : "Product name"}</span><input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label><span>{zh ? "商品分类" : "Product category"}</span><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>{sortProductCategories(categories).map((category) => <option value={category.id} key={category.id}>{category.name[lang]}{category.active ? "" : (zh ? "（已隐藏）" : " (hidden)")}</option>)}</select></label>
          <div className="field-row"><label><span>{zh ? "人民币售价" : "CNY price"}</span><input value={price} onChange={(event) => setPrice(event.target.value)} /></label><label><span>{zh ? "人民币划线价" : "Compare price"}</span><input defaultValue={(product.compare * 1.62).toFixed(2)} /></label></div>
          <div className="field-row"><label><span>{zh ? "库存模式" : "Inventory mode"}</span><select defaultValue={product.stock === Infinity ? "unlimited" : "limited"}><option value="limited">{zh ? "有限库存" : "Limited"}</option><option value="unlimited">{zh ? "无限库存" : "Unlimited"}</option></select></label><label><span>{zh ? "库存数量" : "Inventory"}</span><input defaultValue={product.stock === Infinity ? "" : product.stock} /></label></div>
          <label><span>{zh ? "商品介绍" : "Product introduction"}</span><textarea defaultValue={product.description[lang]} /></label>
        </div>
        <div className="editor-preview">
          <div className="preview-toolbar"><span>{zh ? "实时预览" : "Live preview"}</span><div><button className="is-active">MYR</button><button>USD</button><button>USDT</button></div></div>
          <article className="mini-product-preview"><img src={product.image} alt="" /><small>{product.kicker[lang]}</small><h3>{title}</h3><strong>RM {price ? (Number(price) / 1.62).toFixed(2) : "0.00"}</strong><span>≈ {product.usdt.toFixed(2)} USDT</span><button>{zh ? "立即下单" : "Place order"}<ArrowRight size={14} /></button></article>
        </div>
      </div>
      <div className="drawer-actions"><span>{zh ? "分类设置会保存到本地演示" : "Category settings are saved to this local demo"}</span><button className="admin-secondary" onClick={onClose}>{zh ? "取消" : "Cancel"}</button><button className="admin-primary" onClick={() => { onSaveCategory(product.id, categoryId); onClose(); }}><Check size={18} />{zh ? "保存演示" : "Save demo"}</button></div>
    </Modal>
  );
}

function NotificationDrawer({ open, onClose, lang }) {
  const zh = lang === "zh";
  const notifications = [
    { title: { zh: "新订单等待领取", en: "New order awaiting assignment" }, meta: { zh: "CB-260726-8K3P9M · RM 89.00", en: "CB-260726-8K3P9M · RM 89.00" }, Glyph: Receipt },
    { title: { zh: "Claude Pro 库存较低", en: "Claude Pro inventory low" }, meta: { zh: "仅余 3 件", en: "Only 3 left" }, Glyph: WarningCircle },
    { title: { zh: "邮件通知发送失败", en: "Email delivery failed" }, meta: { zh: "2 条待重试", en: "2 pending retries" }, Glyph: EnvelopeSimple },
  ];
  return (
    <Modal open={open} onClose={onClose} className="admin-notification-drawer" label={zh ? "通知摘要" : "Notification summary"}>
      <DrawerHeader title={zh ? "通知" : "Notifications"} subtitle={zh ? "4 条未读" : "4 unread"} onClose={onClose} lang={lang} />
      <div className="notification-mini-list">
        {notifications.map(({ title, meta, Glyph }) => <button key={title.en}><span><Glyph size={19} /></span><div><strong>{title[lang]}</strong><small>{meta[lang]}</small></div><i /></button>)}
      </div>
      <button className="drawer-full-link" onClick={() => { onClose(); go("/admin/notifications"); }}>{zh ? "打开通知中心" : "Open notification center"}<ArrowRight size={16} /></button>
    </Modal>
  );
}

function AdminApp({
  route,
  lang,
  setLang,
  categories,
  setCategories,
  catalogProducts,
  setProductCategoryAssignments,
  transitServiceConfig,
  onSaveTransitService,
  notify,
  googleAuthenticatorEnabled,
  onGoogleAuthenticatorToggle,
  onSignOut,
}) {
  const page = route.split("/")[2] || "dashboard";
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedGroupId, setExpandedGroupId] = useState(() => findAdminGroup(adminNav, page)?.id || null);
  const [openTabs, setOpenTabs] = useState(() => openAdminTab(["dashboard"], page));
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [sensitiveAction, setSensitiveAction] = useState(null);
  const contentRef = useRef(null);
  useEffect(() => {
    contentRef.current?.focus({ preventScroll: true });
    setOpenTabs((current) => openAdminTab(current, page));
    setExpandedGroupId(findAdminGroup(adminNav, page)?.id || null);
  }, [page]);
  let pageContent;
  if (page === "dashboard") pageContent = <DashboardPage lang={lang} onSelectOrder={setSelectedOrder} />;
  else if (page === "orders") pageContent = <OrdersPage lang={lang} onSelectOrder={setSelectedOrder} />;
  else if (page === "products") pageContent = <ProductsPage lang={lang} onEditProduct={setSelectedProduct} categories={categories} catalogProducts={catalogProducts} />;
  else if (page === "categories") {
    pageContent = (
      <CategoriesPage
        lang={lang}
        categories={categories}
        catalogProducts={catalogProducts}
        onCreateCategory={() => setSelectedCategory({ id: "", name: { zh: "", en: "" }, active: true, order: categories.length + 1 })}
        onEditCategory={setSelectedCategory}
        onToggleCategory={(categoryId) => setCategories((current) => current.map((category) => (
          category.id === categoryId ? { ...category, active: !category.active } : category
        )))}
        onMoveCategory={(categoryId, direction) => setCategories((current) => moveProductCategory(current, categoryId, direction))}
      />
    );
  }
  else {
    pageContent = (
      <GenericAdminPage
        page={page}
        lang={lang}
        onSensitiveAction={setSensitiveAction}
        transitServiceConfig={transitServiceConfig}
        onSaveTransitService={onSaveTransitService}
        notify={notify}
        googleAuthenticatorEnabled={googleAuthenticatorEnabled}
        onGoogleAuthenticatorToggle={(enabled) => {
          onGoogleAuthenticatorToggle(enabled);
          notify({
            type: "success",
            message: lang === "zh"
              ? `Google Authenticator 登录验证已在设计预览中${enabled ? "开启" : "关闭"}`
              : `Google Authenticator sign-in preview ${enabled ? "enabled" : "disabled"}`,
          });
        }}
      />
    );
  }
  const saveCategory = (nextCategory) => {
    setCategories((current) => {
      if (nextCategory.id) {
        return current.map((category) => (category.id === nextCategory.id ? nextCategory : category));
      }
      return [
        ...current,
        {
          ...nextCategory,
          id: `category-${Date.now().toString(36)}`,
          order: current.length + 1,
        },
      ];
    });
    setSelectedCategory(null);
  };
  return (
    <div className={`admin-app ${collapsed ? "is-sidebar-collapsed" : ""}`}>
      <AdminSidebar
        page={page}
        lang={lang}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        expandedGroupId={expandedGroupId}
        setExpandedGroupId={setExpandedGroupId}
      />
      <div className="admin-workspace">
        <AdminTopbar page={page} lang={lang} setLang={setLang} collapsed={collapsed} setCollapsed={setCollapsed} setMobileOpen={setMobileOpen} onNotifications={() => setNotificationsOpen(true)} onSignOut={onSignOut} />
        <AdminWorkspaceTabs page={page} lang={lang} openTabs={openTabs} setOpenTabs={setOpenTabs} />
        <main className="admin-content" aria-labelledby="admin-page-title" tabIndex="-1" ref={contentRef}>{pageContent}</main>
      </div>
      <OrderDrawer order={selectedOrder} onClose={() => setSelectedOrder(null)} lang={lang} onRequestReauth={setSensitiveAction} />
      <ProductDrawer
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onSaveCategory={(productId, categoryId) => setProductCategoryAssignments((current) => ({ ...current, [productId]: categoryId }))}
        categories={categories}
        lang={lang}
      />
      <CategoryDrawer category={selectedCategory} onClose={() => setSelectedCategory(null)} onSave={saveCategory} lang={lang} />
      <NotificationDrawer open={notificationsOpen} onClose={() => setNotificationsOpen(false)} lang={lang} />
      <ReauthModal action={sensitiveAction} onClose={() => setSensitiveAction(null)} lang={lang} />
    </div>
  );
}

export default AdminApp;
