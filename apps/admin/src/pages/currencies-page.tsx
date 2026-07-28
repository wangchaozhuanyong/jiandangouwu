import {
  CaretRight,
  Eye,
  WarningCircle,
} from "@phosphor-icons/react";
import { useCallback, useState } from "react";
import {
  getCurrencies,
  updateRate,
  type AdminCurrency,
  type Locale,
} from "../api";
import {
  invalidateAdminCache,
  useAdminStatus,
  useCachedAdminResource,
  useSlowAdminRequest,
} from "../admin-experience";
import { DesignWorkflowDialog } from "../design-workflows";
import {
  PanelState,
  RefreshNotice,
  StatusPill,
} from "../admin-ui";
import { adminCopy } from "../i18n";

export default function CurrenciesPage({ locale }: { locale: Locale }) {
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
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <>
      <div className="design-preview-note" role="note">
        <Eye size={17} />
        <span>
          <strong>{locale === "zh" ? "汇率历史与启停设计" : "Rate history and activation design"}</strong>
          {locale === "zh" ? "现有单笔汇率更新连接本地服务器；历史、过期提醒和币种启停仅为设计预览。" : "Single-rate updates remain locally connected; history, stale-rate alerts, and activation are design previews."}
        </span>
        <button className="admin-secondary design-note-action" onClick={() => setHistoryOpen(true)}>
          {locale === "zh" ? "打开流程" : "Open flow"}
        </button>
      </div>
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
              <code>1 MYR = {Number(item.rate ?? 0).toFixed(item.digits === 0 ? 2 : 4)}</code>
              <span>{item.digits} {locale === "zh" ? "位小数" : "decimals"}</span>
              <StatusPill status={item.active ? "ACTIVE" : "INACTIVE"} locale={locale} />
              <button aria-label={`${t.changeRate as string} ${item.code}`} aria-expanded={editing === item.code} onClick={() => { setEditing(item.code); setRate(item.rate ?? ""); setReason(""); }}><CaretRight /></button>
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
      {historyOpen && <DesignWorkflowDialog id="currencies" locale={locale} onClose={() => setHistoryOpen(false)} />}
    </>
  );
}
