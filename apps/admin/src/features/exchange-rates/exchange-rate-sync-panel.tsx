import type {
  AdminExchangeRateSyncSettings,
  ExchangeRateIntervalMinutes,
  ExchangeRateMode,
} from "@cloudbridge/contracts";
import {
  ArrowsClockwise,
  CheckCircle,
  Clock,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  invalidateAdminCache,
  useAdminStatus,
  useCachedAdminResource,
  useSlowAdminRequest,
} from "../../admin-experience";
import {
  formatDate,
  PanelState,
  RefreshNotice,
  StatusPill,
} from "../../admin-ui";
import type { Locale } from "../../api";
import {
  getExchangeRateSyncSettings,
  runExchangeRateSync,
  updateExchangeRateSyncSettings,
} from "./api";

const intervals: ReadonlyArray<ExchangeRateIntervalMinutes> = [60, 360, 720, 1440];
const copy = (locale: Locale, zh: string, en: string): string => locale === "zh" ? zh : en;

export default function ExchangeRateSyncPanel({
  canWrite,
  locale,
}: {
  canWrite: boolean;
  locale: Locale;
}) {
  const { notify } = useAdminStatus();
  const loader = useCallback((signal: AbortSignal) => getExchangeRateSyncSettings(signal), []);
  const resource = useCachedAdminResource<AdminExchangeRateSyncSettings>(
    "exchange-rate-sync",
    loader,
  );
  const slow = useSlowAdminRequest(resource.state);
  const [enabled, setEnabled] = useState(true);
  const [intervalMinutes, setIntervalMinutes] = useState<ExchangeRateIntervalMinutes>(360);
  const [modes, setModes] = useState<Record<string, ExchangeRateMode>>({});
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<"save" | "run" | null>(null);

  useEffect(() => {
    if (!resource.data) return;
    setEnabled(resource.data.enabled);
    setIntervalMinutes(resource.data.intervalMinutes);
    setModes(Object.fromEntries(resource.data.currencies.map((item) => [item.code, item.mode])));
  }, [resource.data]);

  const changed = useMemo(() => {
    if (!resource.data) return false;
    return enabled !== resource.data.enabled
      || intervalMinutes !== resource.data.intervalMinutes
      || resource.data.currencies.some((item) => modes[item.code] !== item.mode);
  }, [enabled, intervalMinutes, modes, resource.data]);

  const refresh = () => void resource.reload();
  const mutationReason = reason.trim();

  if (!resource.data) {
    return (
      <section className="admin-panel exchange-sync-panel">
        <PanelState state={resource.state} locale={locale} retry={refresh} />
      </section>
    );
  }

  const settings = resource.data;
  return (
    <section className="admin-panel exchange-sync-panel">
      <div className="exchange-sync-heading">
        <div>
          <small>{copy(locale, "官方数据源", "OFFICIAL DATA SOURCES")}</small>
          <h2>{copy(locale, "自动汇率同步", "Automatic exchange-rate sync")}</h2>
          <p>
            {copy(
              locale,
              "法币来自欧洲央行，USDT/MYR 来自 Coinbase。到期后由前台或后台访问触发，不会覆盖手动模式。",
              "Fiat rates come from the ECB and USDT/MYR from Coinbase. Due syncs are visit-triggered and never overwrite manual mode.",
            )}
          </p>
        </div>
        <StatusPill status={settings.lastStatus ?? "PENDING"} locale={locale} />
      </div>
      <RefreshNotice state={resource.state} locale={locale} retry={refresh} slow={slow} />
      <div className="exchange-sync-facts">
        <span><Clock />{copy(locale, "上次成功", "Last success")}<strong>{settings.lastSuccessAt ? formatDate(settings.lastSuccessAt, locale) : "—"}</strong></span>
        <span><ArrowsClockwise />{copy(locale, "下次到期", "Next due")}<strong>{settings.nextDueAt ? formatDate(settings.nextDueAt, locale) : "—"}</strong></span>
        <span className={settings.lastErrorCode ? "is-warning" : ""}>
          {settings.lastErrorCode ? <WarningCircle /> : <CheckCircle />}
          {copy(locale, "最近结果", "Latest result")}
          <strong>{settings.lastErrorCode ?? settings.lastStatus ?? "—"}</strong>
        </span>
      </div>
      <div className="exchange-sync-controls">
        <label className="exchange-sync-switch">
          <input
            checked={enabled}
            disabled={!canWrite || busy !== null}
            onChange={(event) => setEnabled(event.target.checked)}
            type="checkbox"
          />
          <span>{copy(locale, "启用到期同步", "Enable due sync")}</span>
        </label>
        <label>
          <span>{copy(locale, "同步间隔", "Sync interval")}</span>
          <select
            disabled={!canWrite || busy !== null}
            onChange={(event) => setIntervalMinutes(Number(event.target.value) as ExchangeRateIntervalMinutes)}
            value={intervalMinutes}
          >
            {intervals.map((value) => (
              <option key={value} value={value}>
                {value < 60 ? `${value} min` : `${value / 60} h`}
              </option>
            ))}
          </select>
        </label>
        <label className="exchange-sync-reason">
          <span>{copy(locale, "变更或同步原因", "Change or sync reason")}</span>
          <input
            disabled={!canWrite || busy !== null}
            minLength={8}
            onChange={(event) => setReason(event.target.value)}
            placeholder={copy(locale, "至少 8 个字符", "At least 8 characters")}
            value={reason}
          />
        </label>
      </div>
      <div className="exchange-sync-modes" aria-label={copy(locale, "币种同步模式", "Currency sync modes")}>
        {settings.currencies.map((item) => (
          <label key={item.code}>
            <strong>{item.code}</strong>
            <select
              aria-label={`${item.code} ${copy(locale, "同步模式", "sync mode")}`}
              disabled={!canWrite || busy !== null}
              onChange={(event) => setModes((current) => ({
                ...current,
                [item.code]: event.target.value as ExchangeRateMode,
              }))}
              value={modes[item.code] ?? item.mode}
            >
              <option value="AUTO">AUTO</option>
              <option value="MANUAL">MANUAL</option>
            </select>
            <small className={item.stale ? "is-stale" : ""}>
              {item.stale ? copy(locale, "已陈旧", "Stale") : item.source ?? "—"}
            </small>
          </label>
        ))}
      </div>
      <div className="exchange-sync-actions">
        <button
          className="admin-secondary"
          disabled={!canWrite || busy !== null || mutationReason.length < 8}
          onClick={() => {
            if (!window.confirm(copy(locale, "立即读取外部官方汇率并校验后写入？", "Fetch, validate, and persist official rates now?"))) return;
            setBusy("run");
            void runExchangeRateSync(mutationReason)
              .then((run) => {
                invalidateAdminCache("currencies");
                notify(
                  run.status === "SUCCEEDED"
                    ? copy(locale, "汇率同步完成。", "Exchange-rate sync completed.")
                    : copy(locale, `同步未写入：${run.errorCode ?? run.status}`, `Sync did not write: ${run.errorCode ?? run.status}`),
                  run.status === "SUCCEEDED" ? "success" : "error",
                );
                setReason("");
                void resource.reload();
              })
              .catch(() => notify(copy(locale, "汇率同步失败，旧汇率保持不变。", "Sync failed; existing rates were preserved."), "error"))
              .finally(() => setBusy(null));
          }}
          type="button"
        >
          <ArrowsClockwise />
          {busy === "run" ? copy(locale, "同步中…", "Syncing…") : copy(locale, "立即同步", "Sync now")}
        </button>
        <button
          className="admin-primary"
          disabled={!canWrite || busy !== null || !changed || mutationReason.length < 8}
          onClick={() => {
            if (!window.confirm(copy(locale, "保存自动汇率设置？", "Save automatic exchange-rate settings?"))) return;
            setBusy("save");
            void updateExchangeRateSyncSettings({
              enabled,
              intervalMinutes,
              modes,
              version: settings.version,
              reason: mutationReason,
            })
              .then((value) => {
                resource.commit(value);
                setReason("");
                notify(copy(locale, "自动汇率设置已保存。", "Automatic exchange-rate settings saved."));
              })
              .catch(() => notify(copy(locale, "设置保存失败，请刷新后重试。", "Save failed. Refresh and try again."), "error"))
              .finally(() => setBusy(null));
          }}
          type="button"
        >
          {busy === "save" ? copy(locale, "保存中…", "Saving…") : copy(locale, "保存设置", "Save settings")}
        </button>
      </div>
    </section>
  );
}
