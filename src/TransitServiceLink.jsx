import { ArrowUpRight, Circle, ShareNetwork } from "@phosphor-icons/react";
import {
  isTransitServiceConfigured,
  isTransitServiceVisible,
} from "./transit-service.js";

export function TransitServiceLink({
  config,
  lang,
  preview = false,
  productDetail = false,
  onUnavailable,
}) {
  const visible = isTransitServiceVisible(config);
  const configured = isTransitServiceConfigured(config);
  if (!preview && !visible) return null;

  const label = lang === "zh" ? "中转站服务" : "Transit Service";
  const className = [
    "transit-service-link",
    preview ? "is-preview" : "is-floating",
    productDetail ? "is-product-detail" : "",
    !visible ? "is-disabled-preview" : "",
    visible && !configured ? "is-unconfigured" : "",
  ].filter(Boolean).join(" ");
  const content = (
    <>
      <span className="transit-service-link__signal" aria-hidden="true">
        <Circle className="transit-service-link__pulse" size={7} weight="fill" />
        <ShareNetwork size={23} weight="regular" />
      </span>
      <strong>{label}</strong>
      <ArrowUpRight className="transit-service-link__arrow" size={18} aria-hidden="true" />
    </>
  );

  if (preview) {
    return (
      <span className={className} aria-hidden="true">
        {content}
      </span>
    );
  }

  if (!configured) {
    return (
      <button
        type="button"
        className={className}
        aria-label={lang === "zh" ? "中转站服务地址暂未配置" : "Transit Service address is not configured"}
        title={lang === "zh" ? "服务地址暂未配置" : "Service address not configured"}
        onClick={onUnavailable}
      >
        {content}
      </button>
    );
  }

  return (
    <a
      className={className}
      href={config.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={lang === "zh" ? "在新标签页打开中转站服务" : "Open Transit Service in a new tab"}
    >
      {content}
    </a>
  );
}
