import type { AdminOrderStatusEvent, Locale } from "@cloudbridge/contracts";
import { ArrowRight, Clock } from "@phosphor-icons/react";
import { formatDate, statusLabels } from "../../admin-ui";

const copy = (locale: Locale, zh: string, en: string): string => locale === "zh" ? zh : en;

export function OrderTimeline({
  events,
  locale,
}: {
  events: ReadonlyArray<AdminOrderStatusEvent>;
  locale: Locale;
}) {
  return (
    <section className="order-detail-section">
      <div className="order-detail-section-heading">
        <Clock aria-hidden="true" />
        <h3>{copy(locale, "完整状态时间线", "Complete status timeline")}</h3>
      </div>
      {events.length === 0 ? (
        <p className="order-detail-empty">{copy(locale, "暂无状态记录。", "No status history.")}</p>
      ) : (
        <ol className="order-timeline">
          {events.map((event) => (
            <li key={event.id}>
              <span className="order-timeline-marker" aria-hidden="true" />
              <div>
                <div className="order-timeline-status">
                  <strong>
                    {event.fromStatus
                      ? statusLabels[event.fromStatus]?.[locale] ?? event.fromStatus
                      : copy(locale, "订单创建", "Order created")}
                  </strong>
                  <ArrowRight aria-hidden="true" />
                  <strong>{statusLabels[event.toStatus]?.[locale] ?? event.toStatus}</strong>
                </div>
                <p>{event.reason || copy(locale, "未填写原因", "No reason provided")}</p>
                <small>
                  {event.actor?.displayName ?? copy(locale, "系统", "System")}
                  {" · "}
                  <time dateTime={event.createdAt}>{formatDate(event.createdAt, locale)}</time>
                </small>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
