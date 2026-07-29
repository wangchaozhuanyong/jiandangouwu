import {
  ArrowsClockwise,
  Bell,
  CaretRight,
  ChatsCircle,
  CloudArrowUp,
  CirclesFour,
  Coins,
  Cube,
  Database,
  Image as ImageIcon,
  Key,
  List,
  ListChecks,
  ListMagnifyingGlass,
  LockKey,
  PlugsConnected,
  Receipt,
  ShieldCheck,
  SignOut,
  SlidersHorizontal,
  TelegramLogo,
  Translate,
  UsersThree,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  ApiError,
  completeTotpLogin,
  getFirstAdminSetupStatus,
  getSession,
  loginWithPassword,
  logout,
  setUnauthorizedHandler,
  setupFirstAdmin,
  type AdminUser,
  type Locale,
} from "./api";
import {
  AdminExperienceProvider,
  clearAdminCache,
  setAdminCacheScope,
  useAdminStatus,
} from "./admin-experience";
import {
  pageFromPath,
  pagePath,
  ADMIN_NAVIGATION,
  findAdminNavigationGroup,
  toggleAdminNavigationGroup,
  type AdminNavigationGroupId,
  type Page,
} from "./admin-model";
import { AdminShellSkeleton, Dialog, PanelState } from "./admin-ui";
import { adminCopy } from "./i18n";

const sitesAuthentication = import.meta.env?.VITE_ADMIN_AUTH_PROVIDER === "sites";

const DashboardPage = lazy(() => import("./pages/dashboard-page"));
const ProductsPage = lazy(() => import("./pages/products-page"));
const CategoriesPage = lazy(() => import("./pages/categories-page"));
const OrdersPage = lazy(() => import("./pages/orders-page"));
const AfterSalesPage = lazy(() => import("./features/orders/after-sales-page"));
const ManualPaymentsPage = lazy(() => import("./features/finance/manual-payments-page"));
const ReconciliationPage = lazy(() => import("./features/finance/reconciliation-page"));
const TelegramNewOrderPage = lazy(() => import("./features/notifications/telegram-new-order-page"));
const NotificationsPage = lazy(() => import("./features/notifications/notifications-page"));
const CurrenciesPage = lazy(() => import("./pages/currencies-page"));
const AuditPage = lazy(() => import("./pages/audit-page"));
const SecurityPage = lazy(() => import("./pages/security-page"));
const BannersPage = lazy(() => import("./features/content/banners-page"));
const ContactsPage = lazy(() => import("./features/support/contacts-page"));
const SettingsPage = lazy(() => import("./features/settings/settings-page"));
const TeamPage = lazy(() => import("./features/access/team-page"));
const RolesPage = lazy(() => import("./features/access/roles-page"));
const TranslationsPage = lazy(() => import("./features/translations/translations-page"));
const SecurityEventsPage = lazy(() => import("./features/security-events/security-events-page"));
const DataSecurityPage = lazy(() => import("./features/data-security/data-security-page"));
const SecretsReadinessPage = lazy(() => import("./features/secrets/secrets-readiness-page"));
const BackupReadinessPage = lazy(() => import("./features/backups/backup-readiness-page"));
const IntegrationReadinessPage = lazy(() => import("./features/integrations/integration-readiness-page"));
const MediaPage = lazy(() => import("./features/media/media-page"));
const SitesPlatformPage = lazy(() => import("./features/sites/sites-platform-page"));
const SitesBackupsPage = lazy(() => import("./features/sites/sites-backups-page"));
const pageNavigationIcons: Record<Page, typeof CirclesFour> = {
  dashboard: CirclesFour,
  orders: Receipt,
  disputes: WarningCircle,
  products: Cube,
  categories: ListChecks,
  banners: ImageIcon,
  media: CloudArrowUp,
  translations: Translate,
  contacts: ChatsCircle,
  notifications: Bell,
  "telegram-bot": TelegramLogo,
  currencies: Coins,
  payments: Coins,
  reconciliation: ArrowsClockwise,
  team: UsersThree,
  roles: Key,
  security: LockKey,
  "security-events": WarningCircle,
  "data-security": Database,
  secrets: LockKey,
  logs: ListMagnifyingGlass,
  backups: CloudArrowUp,
  integrations: PlugsConnected,
  settings: SlidersHorizontal,
};

const groupNavigationIcons: Record<AdminNavigationGroupId, typeof CirclesFour> = {
  "orders-after-sales": Receipt,
  "catalog-management": Cube,
  "content-storefront": ImageIcon,
  "support-notifications": ChatsCircle,
  "finance-settlement": Coins,
  "team-access": UsersThree,
  "security-compliance": LockKey,
  "systems-operations": SlidersHorizontal,
};

export function App() {
  const [locale, setLocale] = useState<Locale>("zh");
  const [user, setUser] = useState<AdminUser | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [page, setPage] = useState<Page>(() => (
    typeof window === "undefined" ? "dashboard" : pageFromPath(window.location.pathname)
  ));

  const loadSession = useCallback(async (silent = false) => {
    if (!silent) setSessionLoading(true);
    try {
      const session = await getSession();
      setAdminCacheScope(`${session.user.id}:${[...session.user.permissions].sort().join("|")}`);
      setUser(session.user);
    } catch {
      if (!silent) {
        clearAdminCache();
        setAdminCacheScope(null);
        setUser(null);
      }
    } finally {
      if (!silent) setSessionLoading(false);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearAdminCache();
      setAdminCacheScope(null);
      setUser(null);
      setSessionLoading(false);
    });
    return () => setUnauthorizedHandler(null);
  }, []);
  useEffect(() => { void loadSession(); }, [loadSession]);
  useEffect(() => {
    if (localStorage.getItem("cloudbridge-admin-locale") === "en") setLocale("en");
  }, []);
  useEffect(() => {
    localStorage.setItem("cloudbridge-admin-locale", locale);
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  useEffect(() => {
    const canonical = pagePath(page);
    if (window.location.pathname !== canonical) {
      window.history.replaceState({ page }, "", canonical);
    }
  }, []);

  if (sessionLoading) return <AdminShellSkeleton label={adminCopy[locale].loading as string} locale={locale} />;
  if (!user) {
    return sitesAuthentication
      ? <SitesAuthScreen locale={locale} setLocale={setLocale} />
      : <AuthScreen locale={locale} setLocale={setLocale} onAuthenticated={() => loadSession(false)} />;
  }

  return (
    <AdminExperienceProvider>
      <AuthenticatedAdmin
        locale={locale}
        setLocale={setLocale}
        user={user}
        page={page}
        setPage={setPage}
        refreshSession={() => loadSession(true)}
        onSignedOut={() => {
          clearAdminCache();
          setAdminCacheScope(null);
          setUser(null);
        }}
      />
    </AdminExperienceProvider>
  );
}

function AuthenticatedAdmin({
  locale,
  setLocale,
  user,
  page,
  setPage,
  refreshSession,
  onSignedOut,
}: {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  user: AdminUser;
  page: Page;
  setPage: (page: Page) => void;
  refreshSession: () => Promise<void>;
  onSignedOut: () => void;
}) {
  const t = adminCopy[locale];
  const { confirmNavigation, notify } = useAdminStatus();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<AdminNavigationGroupId | null>(
    () => findAdminNavigationGroup(page)?.id ?? null,
  );
  const [announcement, setAnnouncement] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const go = useCallback((next: Page, historyMode: "push" | "replace" = "push") => {
    if (next !== page && !confirmNavigation(locale)) return;
    if (next !== page) {
      window.history[historyMode === "push" ? "pushState" : "replaceState"]({ page: next }, "", pagePath(next));
      setPage(next);
    }
    setMenuOpen(false);
  }, [confirmNavigation, locale, page, setPage]);

  useEffect(() => {
    const onPopState = () => {
      const next = pageFromPath(window.location.pathname);
      if (next !== page && !confirmNavigation(locale)) {
        window.history.pushState({ page }, "", pagePath(page));
        return;
      }
      setPage(next);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [confirmNavigation, locale, page, setPage]);

  useEffect(() => {
    setExpandedGroup(findAdminNavigationGroup(page)?.id ?? null);
  }, [page]);

  useLayoutEffect(() => {
    const title = t[page] as string;
    document.title = `${title} · CloudBridge`;
    setAnnouncement(locale === "zh" ? `已进入${title}` : `${title} page opened`);
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [locale, page, t]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  const signOut = async () => {
    if (!confirmNavigation(locale)) return;
    try {
      await logout();
      onSignedOut();
    } catch {
      notify(locale === "zh" ? "退出登录未完成，请重试。" : "Sign out did not complete. Try again.", "error");
    }
  };

  return (
    <div className="admin-shell">
      <aside className={menuOpen ? "is-open" : ""}>
        <div className="admin-brand">
          <span><img src="/assets/cloudbridge-logo.png" alt="" width={349} height={176} /></span>
          <div><strong>{t.brandName as string}</strong></div>
          <button className="mobile-close" onClick={() => { setMenuOpen(false); menuButtonRef.current?.focus(); }} aria-label={locale === "zh" ? "关闭导航" : "Close navigation"}><X /></button>
        </div>
        <nav aria-label={locale === "zh" ? "管理后台导航" : "Admin navigation"}>
          {ADMIN_NAVIGATION.map((entry) => {
            if (entry.kind === "link") {
              const Icon = pageNavigationIcons[entry.id];
              return (
                <button
                  className={`admin-nav-link${page === entry.id ? " is-active" : ""}`}
                  aria-current={page === entry.id ? "page" : undefined}
                  onClick={() => {
                    setExpandedGroup(null);
                    go(entry.id);
                  }}
                  key={entry.id}
                >
                  <Icon size={18} weight={page === entry.id ? "fill" : "regular"} />
                  <span>{t[entry.labelKey] as string}</span>
                  <CaretRight size={13} />
                </button>
              );
            }

            const Icon = groupNavigationIcons[entry.id];
            const isExpanded = expandedGroup === entry.id;
            const containsCurrentPage = entry.items.some((item) => item === page);
            const regionId = `admin-navigation-${entry.id}`;

            return (
              <div className={`admin-nav-group${isExpanded ? " is-expanded" : ""}`} key={entry.id}>
                <button
                  className={`admin-nav-primary${containsCurrentPage ? " is-current" : ""}`}
                  aria-expanded={isExpanded}
                  aria-controls={regionId}
                  onClick={() => setExpandedGroup((current) => toggleAdminNavigationGroup(current, entry.id))}
                >
                  <Icon size={18} weight={containsCurrentPage ? "fill" : "regular"} />
                  <span>{t[entry.labelKey] as string}</span>
                  <CaretRight className="admin-nav-caret" size={13} />
                </button>
                {isExpanded && (
                  <div className="admin-nav-children" id={regionId}>
                    {entry.items.map((item) => {
                      const ItemIcon = pageNavigationIcons[item];
                      return (
                        <button
                          className={`admin-nav-child${page === item ? " is-active" : ""}`}
                          aria-current={page === item ? "page" : undefined}
                          onClick={() => go(item)}
                          key={item}
                        >
                          <ItemIcon size={15} weight={page === item ? "fill" : "regular"} />
                          <span>{t[item] as string}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="admin-account">
          <button
            className="admin-account-profile"
            aria-label={locale === "zh" ? "打开管理员账户信息" : "Open administrator account information"}
            onClick={() => setAccountOpen(true)}
          >
            <span>{user.displayName.slice(0, 1).toLocaleUpperCase()}</span>
            <div><strong>{user.displayName}</strong><small>{user.email}</small></div>
          </button>
          <button className="admin-account-signout" title={t.signOut as string} aria-label={t.signOut as string} onClick={() => void signOut()}><SignOut /></button>
        </div>
      </aside>
      {menuOpen && <button className="nav-backdrop" onClick={() => { setMenuOpen(false); menuButtonRef.current?.focus(); }} aria-label={locale === "zh" ? "关闭导航" : "Close navigation"} />}
      <section className="admin-main">
        <header className="admin-topbar">
          <button ref={menuButtonRef} className="mobile-menu" onClick={() => setMenuOpen(true)} aria-expanded={menuOpen} aria-label={locale === "zh" ? "打开导航" : "Open navigation"}><List /></button>
          <div>
            <h1 ref={headingRef} tabIndex={-1}>{t[page] as string}</h1>
          </div>
          <div className="admin-language" aria-label={t.languageLabel as string}>
            <button className={locale === "zh" ? "is-active" : ""} onClick={() => setLocale("zh")}>{t.languageZh as string}</button>
            <span />
            <button className={locale === "en" ? "is-active" : ""} onClick={() => setLocale("en")}>{t.languageEn as string}</button>
          </div>
        </header>
        <main className="admin-content" key={page}>
          <Suspense fallback={<section className="admin-panel"><PanelState state="initial-loading" locale={locale} retry={() => undefined} /></section>}>
            <PageOutlet
              page={page}
              locale={locale}
              user={user}
              refreshSession={refreshSession}
              onNavigate={go}
            />
          </Suspense>
        </main>
      </section>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</div>
      {accountOpen && (
        <AccountCenterDialog
          locale={locale}
          onClose={() => setAccountOpen(false)}
          onSignOut={() => void signOut()}
          user={user}
        />
      )}
    </div>
  );
}

function PageOutlet({
  page,
  locale,
  user,
  refreshSession,
  onNavigate,
}: {
  page: Page;
  locale: Locale;
  user: AdminUser;
  refreshSession: () => Promise<void>;
  onNavigate: (page: Page) => void;
}) {
  if (page === "dashboard") {
    return <DashboardPage locale={locale} onNavigate={onNavigate} user={user} />;
  }
  if (page === "products") {
    return (
      <ProductsPage
        canWrite={user.permissions.includes("catalog.write")}
        locale={locale}
      />
    );
  }
  if (page === "categories") {
    return (
      <CategoriesPage
        canWrite={user.permissions.includes("catalog.write")}
        locale={locale}
      />
    );
  }
  if (page === "orders") {
    return (
      <OrdersPage
        canRevealContact={user.permissions.includes("contacts.reveal")}
        canWrite={user.permissions.includes("orders.write")}
        locale={locale}
      />
    );
  }
  if (page === "disputes") {
    return (
      <AfterSalesPage
        canRevealContact={user.permissions.includes("contacts.reveal")}
        canWrite={user.permissions.includes("orders.write")}
        locale={locale}
      />
    );
  }
  if (page === "payments") {
    return (
      <ManualPaymentsPage
        canRevealContact={user.permissions.includes("contacts.reveal")}
        canWrite={user.permissions.includes("orders.write")}
        locale={locale}
      />
    );
  }
  if (page === "reconciliation") {
    return (
      <ReconciliationPage
        canRead={user.permissions.includes("orders.read")}
        locale={locale}
        onOpenPayments={() => onNavigate("payments")}
      />
    );
  }
  if (page === "telegram-bot") {
    return (
      <TelegramNewOrderPage
        canWrite={user.permissions.includes("settings.write")}
        locale={locale}
      />
    );
  }
  if (page === "notifications") {
    return (
      <NotificationsPage
        canRead={user.permissions.includes("settings.read")}
        locale={locale}
        onOpenTelegram={() => onNavigate("telegram-bot")}
      />
    );
  }
  if (page === "currencies") {
    return (
      <CurrenciesPage
        canWrite={user.permissions.includes("currencies.write")}
        locale={locale}
      />
    );
  }
  if (page === "logs") return <AuditPage locale={locale} />;
  if (page === "security") return <SecurityPage locale={locale} user={user} onChanged={refreshSession} />;
  if (page === "banners") return <BannersPage canWrite={user.permissions.includes("content.write")} locale={locale} />;
  if (page === "contacts") return <ContactsPage canWrite={user.permissions.includes("support.write")} locale={locale} />;
  if (page === "settings") return <SettingsPage canWrite={user.permissions.includes("settings.write")} locale={locale} />;
  if (page === "team") {
    return (
      <TeamPage
        canWrite={user.authProvider !== "SITES" && user.permissions.includes("team.manage")}
        currentUserId={user.id}
        locale={locale}
      />
    );
  }
  if (page === "roles") {
    return <RolesPage canWrite={user.authProvider !== "SITES" && user.permissions.includes("roles.manage")} locale={locale} />;
  }
  if (page === "translations") {
    return <TranslationsPage locale={locale} permissions={user.permissions} />;
  }
  if (page === "security-events") {
    return <SecurityEventsPage locale={locale} />;
  }
  if (page === "data-security") {
    if (user.authProvider === "SITES") return <SitesPlatformPage kind="data-security" locale={locale} />;
    return (
      <DataSecurityPage
        locale={locale}
        onOpenSecurityEvents={() => onNavigate("security-events")}
        user={user}
      />
    );
  }
  if (page === "secrets") {
    if (user.authProvider === "SITES") return <SitesPlatformPage kind="secrets" locale={locale} />;
    return (
      <SecretsReadinessPage
        locale={locale}
        onOpenDataSecurity={() => onNavigate("data-security")}
        onOpenSecurity={() => onNavigate("security")}
      />
    );
  }
  if (page === "backups") {
    if (user.authProvider === "SITES") {
      return (
        <SitesBackupsPage
          canWrite={user.permissions.includes("settings.write")}
          locale={locale}
        />
      );
    }
    return (
      <BackupReadinessPage
        locale={locale}
        onOpenDataSecurity={() => onNavigate("data-security")}
        onOpenSettings={() => onNavigate("settings")}
      />
    );
  }
  if (page === "integrations") {
    if (user.authProvider === "SITES") return <SitesPlatformPage kind="integrations" locale={locale} />;
    return (
      <IntegrationReadinessPage
        locale={locale}
        onOpenBackups={() => onNavigate("backups")}
        onOpenCurrencies={() => onNavigate("currencies")}
        onOpenNotifications={() => onNavigate("notifications")}
        permissions={user.permissions}
      />
    );
  }
  if (page === "media") {
    return (
      <MediaPage
        locale={locale}
        permissions={user.permissions}
        sitesRuntime={user.authProvider === "SITES"}
      />
    );
  }
  const unhandledPage: never = page;
  return unhandledPage;
}

function AccountCenterDialog({
  locale,
  onClose,
  onSignOut,
  user,
}: {
  locale: Locale;
  onClose: () => void;
  onSignOut: () => void;
  user: AdminUser;
}) {
  const sites = user.authProvider === "SITES";
  return (
    <Dialog
      closeLabel={locale === "zh" ? "关闭账户信息" : "Close account information"}
      onClose={onClose}
      title={locale === "zh" ? "管理员账户" : "Administrator account"}
    >
      <div className="admin-account-dialog">
        <div className="admin-account-dialog-identity">
          <span>{user.displayName.slice(0, 1).toLocaleUpperCase()}</span>
          <div><strong>{user.displayName}</strong><small>{user.email}</small></div>
        </div>
        <dl>
          <div>
            <dt>{locale === "zh" ? "登录方式" : "Sign-in method"}</dt>
            <dd>{sites ? "ChatGPT" : locale === "zh" ? "邮箱与密码" : "Email and password"}</dd>
          </div>
          <div>
            <dt>{locale === "zh" ? "后台权限" : "Administration access"}</dt>
            <dd>{user.roles.map((role) => role.name[locale]).join(" · ")}</dd>
          </div>
          <div>
            <dt>{locale === "zh" ? "商城顾客账号" : "Storefront customer account"}</dt>
            <dd>{locale === "zh" ? "不需要" : "Not required"}</dd>
          </div>
        </dl>
        {sites && (
          <p role="note">
            <ShieldCheck size={18} aria-hidden="true" />
            {locale === "zh"
              ? "登录身份由 Sites 的 ChatGPT 登录保护；本站不保存管理员密码。"
              : "Sites protects this area with ChatGPT sign-in; this site stores no administrator password."}
          </p>
        )}
        <button className="admin-danger" onClick={onSignOut} type="button">
          <SignOut size={18} />
          {locale === "zh" ? "退出 ChatGPT 管理登录" : "Sign out of ChatGPT administration"}
        </button>
      </div>
    </Dialog>
  );
}

function SitesAuthScreen({
  locale,
  setLocale,
}: {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}) {
  const t = adminCopy[locale];
  return (
    <main className="auth-page">
      <div className="auth-orbit" aria-hidden="true" />
      <div className="auth-language" aria-label={t.languageLabel as string}>
        <button className={locale === "zh" ? "is-active" : ""} onClick={() => setLocale("zh")}>{t.languageZh as string}</button>
        <span />
        <button className={locale === "en" ? "is-active" : ""} onClick={() => setLocale("en")}>{t.languageEn as string}</button>
      </div>
      <section className="auth-card">
        <div className="auth-brand">
          <span><img src="/assets/cloudbridge-logo.png" alt="" width={349} height={176} /></span>
          <strong>{t.brandName as string}</strong>
        </div>
        <div className="auth-mark"><ShieldCheck size={30} weight="duotone" /></div>
        <h1>{locale === "zh" ? "管理员身份需要重新验证" : "Administrator identity must be verified again"}</h1>
        <p className="auth-intro">
          {locale === "zh"
            ? "商城浏览和下单不需要顾客账号；只有管理后台使用 ChatGPT 登录保护。"
            : "Customers do not need an account to browse or order. Only the administration area uses ChatGPT sign-in."}
        </p>
        <a className="primary-action" href="/signin-with-chatgpt?return_to=%2Fadmin">
          <LockKey size={19} />
          {locale === "zh" ? "使用 ChatGPT 重新登录" : "Sign in again with ChatGPT"}
        </a>
      </section>
    </main>
  );
}

function AuthScreen({
  locale,
  setLocale,
  onAuthenticated,
}: {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  onAuthenticated: () => Promise<void>;
}) {
  const t = adminCopy[locale];
  const [mode, setMode] = useState<"checking" | "login" | "totp" | "setup">("checking");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [flowId, setFlowId] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void getFirstAdminSetupStatus()
      .then(({ available }) => {
        if (active) setMode(available ? "setup" : "login");
      })
      .catch(() => {
        if (active) setMode("login");
      });
    return () => { active = false; };
  }, []);

  const resetLogin = () => {
    setMode("login");
    setPassword("");
    setToken("");
    setFlowId("");
    setError("");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (mode === "login") {
        const result = await loginWithPassword(email, password);
        if (result.requiresTotp) {
          setFlowId(result.flowId);
          setToken("");
          setMode("totp");
          return;
        }
      } else if (mode === "setup") {
        if (password !== confirmPassword) {
          setError(t.passwordMismatch as string);
          return;
        }
        await setupFirstAdmin({ email, displayName, password });
      } else if (mode === "totp") {
        await completeTotpLogin(flowId, token);
      } else {
        return;
      }
      await onAuthenticated();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : locale === "zh" ? "验证未完成，请重试。" : "Verification did not complete. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const title = mode === "setup"
    ? t.firstSetup
    : mode === "totp"
      ? t.totpLoginTitle
      : t.signInTitle;
  const intro = mode === "setup"
    ? t.firstSetupBody
    : mode === "totp"
      ? t.totpLoginBody
      : t.signInBody;

  return (
    <main className="auth-page">
      <div className="auth-orbit" aria-hidden="true" />
      <div className="auth-language" aria-label={t.languageLabel as string}>
        <button className={locale === "zh" ? "is-active" : ""} onClick={() => setLocale("zh")}>{t.languageZh as string}</button>
        <span />
        <button className={locale === "en" ? "is-active" : ""} onClick={() => setLocale("en")}>{t.languageEn as string}</button>
      </div>
      <section className="auth-card">
        <div className="auth-brand">
          <span><img src="/assets/cloudbridge-logo.png" alt="" width={349} height={176} /></span>
          <strong>{t.brandName as string}</strong>
        </div>
        <div className="auth-mark">
          {mode === "totp" ? <ShieldCheck size={30} weight="duotone" /> : <LockKey size={30} weight="duotone" />}
        </div>
        <h1>{title as string}</h1>
        <p className="auth-intro">{intro as string}</p>
        {mode === "checking" ? (
          <div className="auth-checking" role="status">{t.loading as string}</div>
        ) : (
          <form onSubmit={submit}>
            {mode !== "totp" && (
              <label>
                <span>{t.email as string}</span>
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required />
              </label>
            )}
            {mode === "setup" && (
              <label>
                <span>{t.displayName as string}</span>
                <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} maxLength={120} autoComplete="name" required />
              </label>
            )}
            {mode !== "totp" && (
              <label>
                <span>{t.password as string}</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={mode === "setup" ? 12 : 1}
                  maxLength={128}
                  autoComplete={mode === "setup" ? "new-password" : "current-password"}
                  required
                />
              </label>
            )}
            {mode === "setup" && (
              <label>
                <span>{t.confirmPassword as string}</span>
                <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={12} maxLength={128} autoComplete="new-password" required />
              </label>
            )}
            {mode === "totp" && (
              <label>
                <span>{t.totpCode as string}</span>
                <input value={token} onChange={(event) => setToken(event.target.value.replace(/\D/gu, ""))} inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" minLength={6} maxLength={6} required autoFocus />
              </label>
            )}
            {error && <p className="auth-error" role="alert"><WarningCircle />{error}</p>}
            <button className="primary-action" disabled={busy}>
              {mode === "totp" ? <ShieldCheck size={19} /> : <LockKey size={19} />}
              {busy
                ? t.submitting as string
                : mode === "setup"
                  ? t.createAdmin as string
                  : mode === "totp"
                    ? t.verifyAndSignIn as string
                    : t.passwordSignIn as string}
            </button>
          </form>
        )}
        {mode === "totp" && (
          <div className="auth-links">
            <button onClick={resetLogin}>{t.backToLogin as string}</button>
          </div>
        )}
      </section>
    </main>
  );
}
