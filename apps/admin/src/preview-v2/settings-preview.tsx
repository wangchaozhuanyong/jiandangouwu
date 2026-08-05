import {
  ChatCircleDots,
  GearSix,
  Megaphone,
  Network,
  Receipt,
  ShieldCheck,
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import {
  previewSettings,
  type BannerPlacementId,
  type PreviewSettings,
} from "./preview-fixtures";
import type { PreviewLocale } from "./preview-model";
import {
  PreviewBoundaryNote,
  PreviewSectionHeading,
  PreviewToggle,
  previewText,
} from "./preview-components";

type EditableSettings = {
  advertising: Record<BannerPlacementId, boolean>;
  transitEnabled: boolean;
  transitUrl: string;
  supportEnabled: boolean;
  supportChannel: PreviewSettings["supportChannel"];
  ordersEnabled: boolean;
};

const initialSettings = (): EditableSettings => ({
  ...previewSettings,
  advertising: { ...previewSettings.advertising },
});

const advertisingSwitches: Array<{ id: BannerPlacementId; zh: string; en: string }> = [
  { id: "HOME", zh: "首页广告", en: "Home ads" },
  { id: "TRANSIT_SUBSCRIPTIONS", zh: "中转站广告", en: "Transit subscription ads" },
  { id: "AI_RECHARGE", zh: "AI 代充广告", en: "AI recharge ads" },
];

function validHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export default function SettingsPreview({
  locale,
  onFeedback,
}: {
  locale: PreviewLocale;
  onFeedback: (message: string) => void;
}) {
  const [settings, setSettings] = useState<EditableSettings>(initialSettings);
  const transitReady = !settings.transitEnabled || validHttpsUrl(settings.transitUrl);
  const supportReady = settings.supportEnabled && settings.supportChannel.startsWith("DEMO-");
  const orderReady = settings.ordersEnabled && supportReady;
  const enabledAdCount = useMemo(
    () => Object.values(settings.advertising).filter(Boolean).length,
    [settings.advertising],
  );

  const setAdvertising = (id: BannerPlacementId, checked: boolean) => {
    setSettings((current) => ({
      ...current,
      advertising: { ...current.advertising, [id]: checked },
    }));
  };

  const setSupportEnabled = (checked: boolean) => {
    setSettings((current) => ({
      ...current,
      supportEnabled: checked,
      ordersEnabled: checked ? current.ordersEnabled : false,
    }));
  };

  const previewResult = () => {
    if (!transitReady) {
      onFeedback(previewText(locale, "中转站示例地址必须使用有效 HTTPS 格式；本地草稿仍保留。", "The sample transit address must use a valid HTTPS format. The local draft remains available."));
      return;
    }
    onFeedback(previewText(
      locale,
      "已展示设置影响；没有启用广告、中转站、客服或接单能力。",
      "The settings impact is shown. No advertising, transit, support, or ordering capability was enabled.",
    ));
  };

  return (
    <section className="preview-v2-page preview-v2-settings-page">
      <PreviewSectionHeading
        icon={<GearSix aria-hidden="true" size={22} />}
        title={previewText(locale, "网站开关与门禁预览", "Site switches and gate preview")}
        body={previewText(
          locale,
          "检查三个广告开关，以及中转站、客服和人工接单之间的示例依赖关系。",
          "Review three advertising switches and the sample dependencies between transit, support, and manual ordering.",
        )}
      />
      <PreviewBoundaryNote locale={locale}>
        {previewText(
          locale,
          "所有开关均为 DEMO 状态；真实客服渠道、接单门禁和外部地址不会被读取或修改。",
          "Every switch is a DEMO state. Live support channels, order gates, and external addresses are neither read nor changed.",
        )}
      </PreviewBoundaryNote>

      <section className="admin-panel preview-v2-settings-section">
        <PreviewSectionHeading
          icon={<Megaphone aria-hidden="true" size={20} />}
          title={previewText(locale, "广告总开关示例", "Advertising switch samples")}
          body={previewText(locale, `${enabledAdCount} 个 DEMO 版位处于开启样式`, `${enabledAdCount} DEMO placements use the on treatment`)}
        />
        <div className="preview-v2-switch-grid">
          {advertisingSwitches.map((item) => (
            <PreviewToggle
              checked={settings.advertising[item.id]}
              description={previewText(locale, "只影响对应预览标签", "Affects its preview tab only")}
              key={item.id}
              label={item[locale]}
              onChange={(checked) => setAdvertising(item.id, checked)}
            />
          ))}
        </div>
      </section>

      <div className="preview-v2-settings-grid">
        <section className="admin-panel preview-v2-settings-section">
          <PreviewSectionHeading
            icon={<Network aria-hidden="true" size={20} />}
            title={previewText(locale, "中转站示例", "Transit sample")}
            body={previewText(locale, "只检查开关、HTTPS 地址和不可用状态。", "Checks only the switch, HTTPS address, and unavailable state.")}
          />
          <PreviewToggle
            checked={settings.transitEnabled}
            description={previewText(locale, "不会创建或打开外部入口", "Creates or opens no external entry")}
            label={previewText(locale, "中转站示例开关", "Sample transit switch")}
            onChange={(transitEnabled) => setSettings((current) => ({ ...current, transitEnabled }))}
          />
          <label className="preview-v2-field">
            <span>{previewText(locale, "DEMO HTTPS 地址", "DEMO HTTPS address")}</span>
            <input
              aria-invalid={settings.transitEnabled && !transitReady}
              disabled={!settings.transitEnabled}
              onChange={(event) => setSettings((current) => ({ ...current, transitUrl: event.target.value }))}
              value={settings.transitUrl}
            />
            <small>{transitReady ? previewText(locale, "格式可用于界面预览；未核验可访问性。", "The format is usable for UI preview; reachability is not verified.") : previewText(locale, "需要有效 HTTPS 格式。", "A valid HTTPS format is required.")}</small>
          </label>
        </section>

        <section className="admin-panel preview-v2-settings-section">
          <PreviewSectionHeading
            icon={<ChatCircleDots aria-hidden="true" size={20} />}
            title={previewText(locale, "客服示例", "Support sample")}
            body={previewText(locale, "渠道编号全部使用 DEMO 前缀，不包含真实联系账号。", "Every channel ID uses a DEMO prefix and contains no live contact account.")}
          />
          <PreviewToggle
            checked={settings.supportEnabled}
            description={previewText(locale, "关闭时本地接单示例同步关闭", "Turning this off also turns off the local order sample")}
            label={previewText(locale, "客服示例开关", "Sample support switch")}
            onChange={setSupportEnabled}
          />
          <label className="preview-v2-field">
            <span>{previewText(locale, "DEMO 渠道", "DEMO channel")}</span>
            <select disabled={!settings.supportEnabled} value={settings.supportChannel} onChange={(event) => setSettings((current) => ({ ...current, supportChannel: event.target.value as EditableSettings["supportChannel"] }))}>
              <option value="DEMO-WHATSAPP">DEMO-WHATSAPP</option>
              <option value="DEMO-WECHAT">DEMO-WECHAT</option>
              <option value="DEMO-QQ">DEMO-QQ</option>
            </select>
          </label>
        </section>

        <section className="admin-panel preview-v2-settings-section">
          <PreviewSectionHeading
            icon={<Receipt aria-hidden="true" size={20} />}
            title={previewText(locale, "人工接单示例", "Manual-order sample")}
            body={previewText(locale, "只有客服示例开启且存在 DEMO 渠道时才展示可开启状态。", "The on treatment is available only when the support sample and a DEMO channel are present.")}
          />
          <PreviewToggle
            checked={settings.ordersEnabled}
            description={supportReady ? previewText(locale, "示例前置条件已满足", "Sample prerequisites are met") : previewText(locale, "先开启客服示例", "Turn on the support sample first")}
            disabled={!supportReady}
            label={previewText(locale, "接单示例开关", "Sample ordering switch")}
            onChange={(ordersEnabled) => {
              if (!supportReady) return;
              setSettings((current) => ({ ...current, ordersEnabled }));
            }}
          />
          <p className={`preview-v2-gate-state${orderReady ? " is-ready" : ""}`}>
            <ShieldCheck aria-hidden="true" size={19} />
            <span><strong>{orderReady ? previewText(locale, "DEMO 可开启状态", "DEMO ready treatment") : previewText(locale, "DEMO 保持关闭", "DEMO remains off")}</strong><small>{previewText(locale, "不代表正式客户端可以接单", "This does not mean the live storefront can accept orders")}</small></span>
          </p>
        </section>
      </div>

      <div className="preview-v2-editor-actions">
        <button className="admin-secondary" onClick={() => { setSettings(initialSettings()); onFeedback(previewText(locale, "已恢复 DEMO 初始状态；服务器数据未改变。", "The DEMO initial state is restored. Server data is unchanged.")); }} type="button">{previewText(locale, "恢复 DEMO 初始值", "Reset DEMO values")}</button>
        <button className="admin-primary" onClick={previewResult} type="button"><ShieldCheck aria-hidden="true" size={17} />{previewText(locale, "预览设置影响", "Preview settings impact")}</button>
      </div>
    </section>
  );
}
