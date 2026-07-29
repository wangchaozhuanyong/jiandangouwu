import {
  manualPaymentEventTypes,
  type AdminManualPaymentEvent,
  type Locale,
  type ManualPaymentEventType,
} from "@cloudbridge/contracts";
import {
  ArrowsClockwise,
  Bank,
  ClockCounterClockwise,
  FileMagnifyingGlass,
  ListChecks,
  Receipt,
  ShieldWarning,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  useCallback,
  useMemo,
} from "react";
import {
  useCachedAdminResource,
  useSlowAdminRequest,
} from "../../admin-experience";
import {
  formatDate,
  PanelState,
  RefreshNotice,
} from "../../admin-ui";
import { ApiError } from "../../api";
import { getAllManualPaymentEvents } from "./api";
import {
  buildReconciliationReadiness,
  type ReconciliationGateCode,
} from "./reconciliation-model";

const copy = (locale: Locale, zh: string, en: string): string =>
  locale === "zh" ? zh : en;

const eventLabels: Record<ManualPaymentEventType, Record<Locale, string>> = {
  MANUALLY_RECORDED_PAID: { zh: "人工记录已付款", en: "Manually recorded paid" },
  REFUND_REVIEW_STARTED: { zh: "退款复核", en: "Refund review" },
  MANUALLY_RECORDED_REFUNDED: { zh: "人工记录已退款", en: "Manually recorded refunded" },
  DISPUTE_REVIEW_STARTED: { zh: "争议复核", en: "Dispute review" },
};

const gateCopy: Record<
  ReconciliationGateCode,
  {
    title: Record<Locale, string>;
    body: Record<Locale, string>;
  }
> = {
  PAYMENT_PROVIDER: {
    title: { zh: "支付提供商连接", en: "Payment provider connection" },
    body: {
      zh: "尚未接入支付商、银行或钱包账户。",
      en: "No payment provider, bank, or wallet account is connected.",
    },
  },
  WEBHOOK_INGESTION: {
    title: { zh: "Webhook 验签与幂等", en: "Webhook verification and idempotency" },
    body: {
      zh: "尚未开发外部事件验签、去重与结果保存。",
      en: "External event verification, deduplication, and result storage are not implemented.",
    },
  },
  EXTERNAL_TRANSACTION_IDS: {
    title: { zh: "外部交易标识", en: "External transaction identifiers" },
    body: {
      zh: "现有人工状态历史没有支付商交易 ID。",
      en: "The current manual status history has no provider transaction IDs.",
    },
  },
  SETTLEMENT_STATEMENTS: {
    title: { zh: "结算账单与费用", en: "Settlement statements and fees" },
    body: {
      zh: "尚未采集结算文件、手续费、税费或实际到账金额。",
      en: "Settlement files, fees, taxes, and actual received amounts are not collected.",
    },
  },
  MATCHING_AND_EXCEPTIONS: {
    title: { zh: "匹配与差异处理", en: "Matching and exception handling" },
    body: {
      zh: "尚未开发订单匹配、差额计算、复核或结案流程。",
      en: "Order matching, variance calculation, review, and resolution are not implemented.",
    },
  },
};

export default function ReconciliationPage({
  canRead,
  locale,
  onOpenPayments,
}: {
  canRead: boolean;
  locale: Locale;
  onOpenPayments: () => void;
}) {
  const loader = useCallback(
    (signal: AbortSignal) => canRead
      ? getAllManualPaymentEvents(signal)
      : Promise.reject(new ApiError("Forbidden", 403, "FORBIDDEN")),
    [canRead],
  );
  const resource = useCachedAdminResource<AdminManualPaymentEvent[]>(
    canRead ? "manual-payment-events:reconciliation-all" : "reconciliation:forbidden",
    loader,
  );
  const slow = useSlowAdminRequest(resource.state);
  const readiness = useMemo(
    () => resource.data ? buildReconciliationReadiness(resource.data) : null,
    [resource.data],
  );

  const retry = () => {
    void resource.reload();
  };

  return (
    <section className="reconciliation-page">
      <div className="reconciliation-truth-note" role="note">
        <WarningCircle size={20} aria-hidden="true" />
        <span>
          <strong>{copy(locale, "当前只有内部人工记录，不是外部对账", "Only internal manual records exist; this is not external reconciliation")}</strong>
          {copy(
            locale,
            "本页只读取平台数据库中的人工付款、退款与争议状态历史。它不能证明款项到账、退款完成、渠道结算或金额匹配；没有外部证据时显示“未采集”，不会用 0 或虚构外部结算数据代替。",
            "This page only reads platform-database manual payment, refund, and dispute status history. It cannot prove receipt, refund, provider settlement, or amount matching. Missing external evidence is shown as “not collected,” never as zero or fabricated external settlement data.",
          )}
        </span>
      </div>

      {!canRead ? (
        <section className="admin-panel">
          <PanelState state="forbidden" locale={locale} retry={() => undefined} kind="cards" />
        </section>
      ) : !readiness ? (
        <section className="admin-panel">
          <PanelState state={resource.state} locale={locale} retry={retry} kind="cards" />
        </section>
      ) : (
        <>
          <div className="reconciliation-summary">
            <ReconciliationStat
              icon={Receipt}
              label={copy(locale, "内部人工记录", "Internal manual records")}
              value={String(readiness.totalInternalEvents)}
              detail={copy(locale, "来自订单状态历史", "From order status history")}
            />
            <ReconciliationStat
              icon={ListChecks}
              label={copy(locale, "涉及币种", "Currencies represented")}
              value={String(readiness.currencyEvidence.length)}
              detail={copy(locale, "不跨币种合计金额", "No cross-currency total")}
            />
            <ReconciliationStat
              icon={ShieldWarning}
              label={copy(locale, "外部资金核验", "External funds verification")}
              value={copy(locale, "否", "No")}
              detail={copy(locale, "所有记录均未外部核验", "Every record remains unverified")}
              tone="warning"
            />
            <ReconciliationStat
              icon={ClockCounterClockwise}
              label={copy(locale, "外部对账结果", "External reconciliation result")}
              value={copy(locale, "未采集", "Not collected")}
              detail={readiness.externalEvidenceState}
              tone="neutral"
            />
          </div>

          <div className="reconciliation-toolbar">
            <p>
              <FileMagnifyingGlass size={17} aria-hidden="true" />
              {copy(
                locale,
                "这里判断证据是否齐全；逐条人工状态记录在“支付与收款”中查看。",
                "This page evaluates evidence readiness. Inspect each manual status record under Payments.",
              )}
            </p>
            <button className="admin-secondary" onClick={retry} type="button">
              <ArrowsClockwise size={17} aria-hidden="true" />
              {copy(locale, "刷新证据", "Refresh evidence")}
            </button>
            <button className="admin-primary" onClick={onOpenPayments} type="button">
              <Receipt size={17} aria-hidden="true" />
              {copy(locale, "打开人工收款记录", "Open manual payment records")}
            </button>
          </div>

          <RefreshNotice
            state={resource.state}
            locale={locale}
            retry={retry}
            slow={slow}
          />

          <div className="reconciliation-readiness-layout" aria-busy={resource.state === "refreshing"}>
            <section className="admin-panel reconciliation-source">
              <div className="reconciliation-panel-heading">
                <div>
                  <small>{copy(locale, "真实内部证据", "LIVE INTERNAL EVIDENCE")}</small>
                  <h2>{copy(locale, "人工状态历史范围", "Manual status-history scope")}</h2>
                  <p>{copy(locale, "来自全部分页，不包含外部支付或结算记录。", "Loaded across every page; excludes external payment and settlement records.")}</p>
                </div>
                <span className="reconciliation-state is-internal">INTERNAL_ONLY</span>
              </div>

              <dl className="reconciliation-source-facts">
                <div>
                  <dt>{copy(locale, "数据来源", "Data source")}</dt>
                  <dd><code>OrderStatusHistory</code></dd>
                </div>
                <div>
                  <dt>{copy(locale, "外部核验", "External verification")}</dt>
                  <dd>{copy(locale, "全部为否", "No for every record")}</dd>
                </div>
                <div>
                  <dt>{copy(locale, "最新内部记录", "Latest internal record")}</dt>
                  <dd>{readiness.latestRecordedAt ? formatDate(readiness.latestRecordedAt, locale) : copy(locale, "暂无记录", "No records")}</dd>
                </div>
                <div>
                  <dt>{copy(locale, "金额汇总", "Amount aggregation")}</dt>
                  <dd>{copy(locale, "不提供跨币种合计", "No cross-currency total")}</dd>
                </div>
              </dl>

              <div className="reconciliation-event-types">
                <div>
                  <strong>{copy(locale, "内部记录类型", "Internal record types")}</strong>
                  <small>{readiness.totalInternalEvents}</small>
                </div>
                <ul>
                  {manualPaymentEventTypes.map((eventType) => (
                    <li key={eventType}>
                      <span>{eventLabels[eventType][locale]}</span>
                      <strong>{readiness.eventTypeCounts[eventType]}</strong>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="reconciliation-currencies">
                <strong>{copy(locale, "币种分布（按记录数）", "Currency distribution by record count")}</strong>
                {readiness.currencyEvidence.length > 0 ? (
                  <ul>
                    {readiness.currencyEvidence.map((item) => (
                      <li key={item.currency}>
                        <code>{item.currency}</code>
                        <span>{copy(locale, `${item.eventCount} 条`, `${item.eventCount} records`)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>{copy(locale, "当前没有内部人工收款状态记录。", "No internal manual payment status records exist.")}</p>
                )}
              </div>
            </section>

            <section className="admin-panel reconciliation-gates">
              <div className="reconciliation-panel-heading">
                <div>
                  <small>{copy(locale, "上线门槛", "LAUNCH GATES")}</small>
                  <h2>{copy(locale, "仍需完成的对账基础设施", "Reconciliation infrastructure still required")}</h2>
                  <p>{copy(locale, "未开发与未采集保持不同状态。", "Not implemented and not collected remain distinct.")}</p>
                </div>
              </div>
              <ol>
                {readiness.gates.map((gate) => (
                  <li key={gate.code}>
                    <span className={`reconciliation-gate-icon is-${gate.state === "NOT_IMPLEMENTED" ? "missing" : "uncollected"}`}>
                      {gate.state === "NOT_IMPLEMENTED"
                        ? <ClockCounterClockwise size={18} aria-hidden="true" />
                        : <FileMagnifyingGlass size={18} aria-hidden="true" />}
                    </span>
                    <div>
                      <strong>{gateCopy[gate.code].title[locale]}</strong>
                      <p>{gateCopy[gate.code].body[locale]}</p>
                    </div>
                    <span className={`reconciliation-state is-${gate.state === "NOT_IMPLEMENTED" ? "missing" : "uncollected"}`}>
                      {gate.state === "NOT_IMPLEMENTED"
                        ? copy(locale, "未开发", "Not implemented")
                        : copy(locale, "未采集", "Not collected")}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <section className="admin-panel reconciliation-records">
            <div className="reconciliation-records-heading">
              <div>
                <small>{copy(locale, "最近内部记录", "RECENT INTERNAL RECORDS")}</small>
                <h2>{copy(locale, "仅用于确认内部证据范围", "For internal evidence scope only")}</h2>
              </div>
              <span>{copy(locale, `最多显示 ${readiness.recentInternalEvents.length} 条`, `Showing up to ${readiness.recentInternalEvents.length}`)}</span>
            </div>
            {readiness.recentInternalEvents.length > 0 ? (
              <div
                className="reconciliation-record-table-wrap"
                tabIndex={0}
                aria-label={copy(locale, "最近内部人工记录表，可横向滚动", "Recent internal manual records table, horizontally scrollable")}
              >
                <table className="reconciliation-record-table">
                  <thead>
                    <tr>
                      <th scope="col">{copy(locale, "事件 ID", "Event ID")}</th>
                      <th scope="col">{copy(locale, "记录时间", "Recorded")}</th>
                      <th scope="col">{copy(locale, "订单号", "Order")}</th>
                      <th scope="col">{copy(locale, "记录类型", "Record type")}</th>
                      <th scope="col">{copy(locale, "金额", "Amount")}</th>
                      <th scope="col">{copy(locale, "币种", "Currency")}</th>
                      <th scope="col">{copy(locale, "操作者", "Actor")}</th>
                      <th scope="col">{copy(locale, "外部核验", "External verification")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {readiness.recentInternalEvents.map((event) => (
                      <tr key={event.statusHistoryId}>
                        <td><code>{event.statusHistoryId}</code></td>
                        <td><time dateTime={event.recordedAt}>{formatDate(event.recordedAt, locale)}</time></td>
                        <td><code>{event.orderNumber}</code></td>
                        <td>{eventLabels[event.eventType][locale]}</td>
                        <td>{event.orderAmount.amount}</td>
                        <td>{event.orderAmount.currency}</td>
                        <td>{event.actor?.displayName ?? "—"}</td>
                        <td><span className="reconciliation-unverified">{copy(locale, "否", "No")}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="reconciliation-records-empty" role="status">
                <Receipt size={28} aria-hidden="true" />
                <strong>{copy(locale, "当前没有内部人工记录", "No internal manual records")}</strong>
                <p>{copy(locale, "订单进入人工付款、退款或争议状态后会出现在这里。", "Records appear after an order enters a manual payment, refund, or dispute state.")}</p>
              </div>
            )}
          </section>

          <section className="admin-panel reconciliation-evidence">
            <span><Bank size={23} aria-hidden="true" /></span>
            <div>
              <small>{readiness.externalEvidenceState}</small>
              <h2>{copy(locale, "当前没有可核验的外部结算证据", "No verifiable external settlement evidence is available")}</h2>
              <p>
                {copy(
                  locale,
                  "系统尚未采集支付商账单、银行流水、外部交易 ID、结算批次、手续费、税费、实际到账金额、匹配结果或差异。这些数据是未采集，不是零。",
                  "Provider statements, bank records, external transaction IDs, settlement batches, fees, taxes, actual received amounts, matches, and variances are not collected. These values are not collected, not zero.",
                )}
              </p>
            </div>
          </section>
        </>
      )}
    </section>
  );
}

function ReconciliationStat({
  icon: Icon,
  label,
  value,
  detail,
  tone = "default",
}: {
  icon: typeof Bank;
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "warning" | "neutral";
}) {
  return (
    <article className={`reconciliation-stat is-${tone}`}>
      <span><Icon size={21} aria-hidden="true" /></span>
      <small>{label}</small>
      <strong>{value}</strong>
      <em>{detail}</em>
    </article>
  );
}
