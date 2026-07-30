import {
  CaretRight,
  Eye,
  WarningCircle,
} from "@phosphor-icons/react";
import { useCallback, useState } from "react";
import {
  getCurrencies,
  getCurrencyRateHistory,
  updateRate,
  type AdminCurrency,
  type AdminCurrencyRate,
  type Locale,
} from "../api";
import {
  invalidateAdminCache,
  useAdminStatus,
  useCachedAdminResource,
  useSlowAdminRequest,
} from "../admin-experience";
import {
  Dialog,
  formatDate,
  PanelState,
  RefreshNotice,
  StatusPill,
} from "../admin-ui";
import { adminCopy } from "../i18n";
import ExchangeRateSyncPanel from "../features/exchange-rates/exchange-rate-sync-panel";

export default function CurrenciesPage({
  canWrite,
  locale,
}: {
  canWrite: boolean;
  locale: Locale;
}) {
  const t = adminCopy[locale];
  const { notify } = useAdminStatus();
  const loader = useCallback((signal: AbortSignal) => getCurrencies(signal), []);
  const { data, state, reload } = useCachedAdminResource<AdminCurrency[]>("currencies", loader);
  const slow = useSlowAdminRequest(state);
  const [editing, setEditing] = useState<string | null>(null);
  const [rate, setRate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [historyCode, setHistoryCode] = useState<string | null>(null);
  const [history, setHistory] = useState<AdminCurrencyRate[] | null>(null);
  const [historyError, setHistoryError] = useState("");

  const openHistory = (code: string) => {
    setHistoryCode(code);
    setHistory(null);
    setHistoryError("");
    void getCurrencyRateHistory(code)
      .then(setHistory)
      .catch(() => setHistoryError(locale === "zh" ? "汇率历史加载失败，请重试。" : "Rate history failed to load. Try again."));
  };

  return (
    <>
      <div className="design-preview-note" role="note">
        <Eye size={17} />
        <span>
          <strong>{locale === "zh" ? "Sites D1 实时汇率" : "Live Sites D1 rates"}</strong>
          {locale === "zh"
            ? "当前报价与历史记录均从 Sites 数据库读取；更新会新增一条带生效时间的记录，不会覆盖旧记录。"
            : "Current quotes and history come from the Sites database. Updating appends a timestamped record without overwriting earlier values."}
        </span>
      </div>
      <ExchangeRateSyncPanel canWrite={canWrite} locale={locale} />
      <section className="admin-panel">
        <RefreshNotice state={state} locale={locale} retry={() => void reload()} slow={slow} />
        {!data ? <PanelState state={state} locale={locale} retry={() => void reload()} /> : (
          <div className="currency-table" tabIndex={0} aria-label={locale === "zh" ? "币种表，可横向滚动" : "Currency table, horizontally scrollable"}>
          <div className="currency-head"><span>{t.currencyToken as string}</span><span>{t.currencyCode as string}</span><span>{t.currencyName as string}</span><span>{t.currentRate as string}</span><span>{t.precision as string}</span><span>{t.status as string}</span><span /></div>
          {data.length === 0 && <div className="table-empty">{t.empty as string}</div>}
          {data.map((item) => (
            <article key={item.code}>
              <div className="currency-token"><b>{item.token}</b></div>
              <strong className="currency-code">{item.code}</strong>
              <span className="currency-name" title={item.name[locale]}>{item.name[locale]}</span>
              <code>1 MYR = {item.rate ?? "—"}</code>
              <span>{item.digits} {locale === "zh" ? "位小数" : "decimals"}</span>
              <StatusPill status={item.active ? "ACTIVE" : "INACTIVE"} locale={locale} />
              <div className="currency-row-actions">
                <button
                  aria-label={`${locale === "zh" ? "查看汇率历史" : "View rate history"} ${item.code}`}
                  onClick={() => openHistory(item.code)}
                  type="button"
                ><Eye /></button>
                {canWrite && (
                  <button aria-label={`${t.changeRate as string} ${item.code}`} aria-expanded={editing === item.code} onClick={() => { setEditing(item.code); setRate(item.rate ?? ""); setReason(""); }}><CaretRight /></button>
                )}
              </div>
              {editing === item.code && (
                <form className="inline-rate-editor" onSubmit={(event) => {
                  event.preventDefault();
                  if (busy || !window.confirm(t.rateConfirm as string)) return;
                  setBusy(true);
                  setError("");
                  void updateRate(item.code, rate, reason)
                    .then(() => {
                      invalidateAdminCache("currencies");
                      setEditing(null);
                      notify(locale === "zh" ? "汇率已更新。" : "Currency rate updated.");
                      void reload();
                    })
                    .catch(() => {
                      setError(t.saveError as string);
                      notify(t.saveError as string, "error");
                    })
                    .finally(() => setBusy(false));
                }}>
                  <label><span>{t.currentRate as string}</span><input value={rate} onChange={(event) => setRate(event.target.value)} pattern="\d+(?:\.\d{1,8})?" required /></label>
                  <label><span>{t.reason as string}</span><input value={reason} onChange={(event) => setReason(event.target.value)} minLength={8} required /></label>
                  <button type="button" onClick={() => setEditing(null)}>{t.cancel as string}</button>
                  <button className="admin-primary" disabled={busy}>{busy ? t.submitting as string : t.changeRate as string}</button>
                </form>
              )}
            </article>
          ))}
          {error && <p className="table-action-error" role="alert"><WarningCircle />{error}</p>}
          </div>
        )}
      </section>
      {historyCode && (
        <Dialog
          closeLabel={locale === "zh" ? "关闭汇率历史" : "Close rate history"}
          onClose={() => setHistoryCode(null)}
          title={`${historyCode} · ${locale === "zh" ? "汇率历史" : "Rate history"}`}
          wide
        >
          <div className="currency-history">
            {!history && !historyError && <PanelState state="initial-loading" locale={locale} retry={() => undefined} />}
            {historyError && <p className="table-action-error" role="alert"><WarningCircle />{historyError}</p>}
            {history && history.length === 0 && <div className="table-empty">{t.empty as string}</div>}
            {history && history.length > 0 && (
              <div className="currency-history-table-wrap" tabIndex={0}>
                <table>
                  <thead><tr><th>{locale === "zh" ? "换算" : "Pair"}</th><th>{locale === "zh" ? "汇率" : "Rate"}</th><th>{locale === "zh" ? "来源" : "Source"}</th><th>{locale === "zh" ? "生效时间" : "Effective at"}</th><th>{locale === "zh" ? "过期时间" : "Expires at"}</th></tr></thead>
                  <tbody>
                    {history.map((entry) => (
                      <tr key={entry.id}>
                        <td><code>{entry.fromCode} → {entry.toCode}</code></td>
                        <td><code>{entry.rate}</code></td>
                        <td>{entry.source}</td>
                        <td>{formatDate(entry.effectiveAt, locale)}</td>
                        <td>{entry.expiresAt ? formatDate(entry.expiresAt, locale) : locale === "zh" ? "未设置" : "Not set"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Dialog>
      )}
    </>
  );
}
