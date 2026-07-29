import type { Locale } from "@cloudbridge/contracts";
import { WarningCircle } from "@phosphor-icons/react";
import OrdersPage from "../../pages/orders-page";

const copy = (locale: Locale, zh: string, en: string): string => locale === "zh" ? zh : en;

export default function AfterSalesPage({
  canRevealContact,
  canWrite,
  locale,
}: {
  canRevealContact: boolean;
  canWrite: boolean;
  locale: Locale;
}) {
  return (
    <>
      <div className="after-sales-truth-note" role="note">
        <WarningCircle aria-hidden="true" />
        <span>
          <strong>{copy(locale, "人工售后订单视图", "Manual after-sales order view")}</strong>
          {copy(
            locale,
            "退款和争议状态仅代表管理员人工记录；本页不会调用支付机构、自动退款，也不能作为到账或退款完成证明。",
            "Refund and dispute states are manual admin records only. This page does not contact a payment provider, issue automatic refunds, or prove that funds were received or returned.",
          )}
        </span>
      </div>
      <OrdersPage
        canRevealContact={canRevealContact}
        canWrite={canWrite}
        locale={locale}
        scope="AFTER_SALES"
      />
    </>
  );
}
