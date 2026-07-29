import {
  Archive,
  ArrowsClockwise,
  Clock,
  CloudArrowUp,
  Database,
  HardDrives,
  ShieldCheck,
  WarningCircle,
} from "@phosphor-icons/react";
import { useMemo } from "react";
import type { Locale } from "../../api";
import {
  buildBackupReadiness,
  type BackupControlCode,
  type BackupGateCode,
  type BackupResourceCode,
} from "./model";

const copy = (locale: Locale, zh: string, en: string): string =>
  locale === "zh" ? zh : en;

type IconComponent = typeof Archive;

const resourceCopy: Record<
  BackupResourceCode,
  {
    title: Record<Locale, string>;
    body: Record<Locale, string>;
    location: string;
    evidence: string;
    icon: IconComponent;
  }
> = {
  LOCAL_MYSQL_VOLUME: {
    title: { zh: "本地 MySQL 命名卷", en: "Local MySQL named volume" },
    body: {
      zh: "Compose 把 MySQL 数据目录挂载到同机命名卷。容器重建时可保留数据，但卷删除、磁盘故障或整机丢失仍会造成风险。",
      en: "Compose mounts the MySQL data directory to a named volume on the same host. It can survive container replacement, but not volume deletion, disk failure, or host loss.",
    },
    location: "cloudbridge_mysql → /var/lib/mysql",
    evidence: "compose.yaml",
    icon: Database,
  },
  LOCAL_VALKEY_VOLUME: {
    title: { zh: "本地 Valkey 命名卷", en: "Local Valkey named volume" },
    body: {
      zh: "Compose 为 Valkey 配置同机命名卷和 AOF 持久化。它支持进程恢复，不等于独立备份或恢复演练。",
      en: "Compose configures a same-host named volume and AOF persistence for Valkey. It supports process recovery, not an independent backup or restore drill.",
    },
    location: "cloudbridge_redis → /data",
    evidence: "valkey-server --appendonly yes",
    icon: HardDrives,
  },
  AWS_RDS_AUTOMATED_BACKUP: {
    title: { zh: "AWS RDS 自动备份定义", en: "AWS RDS automated-backup definition" },
    body: {
      zh: "CDK 定义 MySQL Multi-AZ、存储加密、7 天自动备份、删除保护、保留自动备份与资源保留策略。",
      en: "CDK defines MySQL Multi-AZ, encrypted storage, seven-day automated backups, deletion protection, retained automated backups, and a retain policy.",
    },
    location: "CloudBridgeStaging/Database",
    evidence: "backupRetention: 7 days",
    icon: CloudArrowUp,
  },
  AWS_VALKEY_SNAPSHOT: {
    title: { zh: "AWS Valkey 快照定义", en: "AWS Valkey snapshot definition" },
    body: {
      zh: "CDK 定义双节点 Multi-AZ Valkey、静态与传输加密、7 份快照保留和 18:00–19:00 快照窗口。",
      en: "CDK defines two-node Multi-AZ Valkey, encryption at rest and in transit, seven retained snapshots, and an 18:00–19:00 snapshot window.",
    },
    location: "CloudBridgeStaging/Cache",
    evidence: "snapshotRetentionLimit: 7",
    icon: Archive,
  },
};

const controlCopy: Record<
  BackupControlCode,
  {
    title: Record<Locale, string>;
    body: Record<Locale, string>;
    evidence: string;
    icon: IconComponent;
  }
> = {
  LOCAL_NAMED_VOLUMES: {
    title: { zh: "本地数据目录持久化", en: "Local data-directory persistence" },
    body: {
      zh: "MySQL 与 Valkey 数据目录都映射到独立 Docker 命名卷，普通容器替换不会直接删除卷。",
      en: "MySQL and Valkey data directories map to separate Docker named volumes, so ordinary container replacement does not directly delete them.",
    },
    evidence: "compose.yaml · 2 named volumes",
    icon: HardDrives,
  },
  VALKEY_APPEND_ONLY: {
    title: { zh: "Valkey AOF 持久化", en: "Valkey AOF persistence" },
    body: {
      zh: "本地 Valkey 使用 append-only 模式记录变更；它降低进程重启风险，但不是离机副本。",
      en: "Local Valkey uses append-only persistence to record changes. It reduces process-restart risk but is not an off-host copy.",
    },
    evidence: "--appendonly yes",
    icon: Archive,
  },
  RDS_STORAGE_ENCRYPTION: {
    title: { zh: "RDS 存储加密与 Multi-AZ", en: "RDS encryption and Multi-AZ" },
    body: {
      zh: "CDK 打开 RDS 存储加密并使用 Multi-AZ；高可用副本不能替代备份。",
      en: "CDK enables RDS storage encryption and Multi-AZ. A high-availability replica does not replace a backup.",
    },
    evidence: "storageEncrypted · multiAz",
    icon: ShieldCheck,
  },
  RDS_BACKUP_RETENTION: {
    title: { zh: "RDS 七天保留定义", en: "RDS seven-day retention definition" },
    body: {
      zh: "模板配置 7 天自动备份并要求删除实例时保留自动备份；当前没有部署或快照清单证据。",
      en: "The template configures seven-day automated backups and retains them when the instance is deleted. There is no deployment or snapshot-inventory evidence yet.",
    },
    evidence: "backupRetention · deleteAutomatedBackups: false",
    icon: Clock,
  },
  RDS_DELETION_PROTECTION: {
    title: { zh: "RDS 删除保护与资源保留", en: "RDS deletion protection and retain policy" },
    body: {
      zh: "模板开启删除保护并使用 `RETAIN`；它减少误删风险，但不会验证备份可恢复。",
      en: "The template enables deletion protection and uses `RETAIN`. This reduces accidental deletion risk but does not prove recoverability.",
    },
    evidence: "deletionProtection · RemovalPolicy.RETAIN",
    icon: ShieldCheck,
  },
  VALKEY_SNAPSHOT_RETENTION: {
    title: { zh: "Valkey 七份快照定义", en: "Valkey seven-snapshot definition" },
    body: {
      zh: "模板配置 7 份快照和固定快照窗口；当前没有部署、快照清单或恢复验证。",
      en: "The template configures seven retained snapshots and a fixed snapshot window. It has no deployment, inventory, or restore evidence yet.",
    },
    evidence: "snapshotRetentionLimit · snapshotWindow",
    icon: ArrowsClockwise,
  },
};

const gateCopy: Record<
  BackupGateCode,
  {
    title: Record<Locale, string>;
    body: Record<Locale, string>;
  }
> = {
  LOCAL_AUTOMATED_BACKUP: {
    title: { zh: "本地自动备份任务", en: "Automated local backup job" },
    body: {
      zh: "项目没有 MySQL 导出、Valkey 备份、调度、校验或清理脚本。",
      en: "The project has no MySQL export, Valkey backup, scheduling, verification, or cleanup job.",
    },
  },
  OFF_HOST_BACKUP_COPY: {
    title: { zh: "离机与独立故障域副本", en: "Off-host and separate-failure-domain copy" },
    body: {
      zh: "尚未批准本地离机存储、跨区域、跨账户或不可变副本策略。",
      en: "No local off-host, cross-region, cross-account, or immutable-copy policy is approved.",
    },
  },
  AWS_DEPLOYMENT_EVIDENCE: {
    title: { zh: "AWS 部署证据", en: "AWS deployment evidence" },
    body: {
      zh: "CDK 已定义保护，但尚未 deploy；当前没有 RDS 或 Valkey 快照资源。",
      en: "CDK defines protections, but no deploy has occurred; there are no RDS or Valkey snapshot resources.",
    },
  },
  RUNTIME_BACKUP_INVENTORY: {
    title: { zh: "运行时备份清单", en: "Runtime backup inventory" },
    body: {
      zh: "尚无受保护接口返回备份存在状态、时间、大小、校验和或过期时间。",
      en: "No protected endpoint returns backup existence, time, size, checksum, or expiry metadata.",
    },
  },
  BACKUP_FAILURE_ALERTING: {
    title: { zh: "备份失败与过期告警", en: "Backup failure and expiry alerting" },
    body: {
      zh: "尚未实现备份缺失、失败、过期、容量异常或恢复验证失败告警。",
      en: "Missing, failed, expired, oversized, or restore-verification backup alerts are not implemented.",
    },
  },
  RECOVERY_RUNBOOK: {
    title: { zh: "恢复与回滚手册", en: "Recovery and rollback runbook" },
    body: {
      zh: "尚未批准负责人、维护窗口、恢复顺序、数据校验、流量切换和失败回滚。",
      en: "Ownership, maintenance window, restore order, data verification, traffic cutover, and failure rollback are not approved.",
    },
  },
  RPO_RTO_APPROVAL: {
    title: { zh: "RPO / RTO 正式批准", en: "Approved RPO / RTO" },
    body: {
      zh: "文档中的 5 分钟 RPO 与 60 分钟 RTO 只是未来目标，当前没有责任人和演练证据。",
      en: "The documented five-minute RPO and sixty-minute RTO are future targets without an owner or drill evidence.",
    },
  },
  ISOLATED_RESTORE_DRILL: {
    title: { zh: "隔离环境恢复演练", en: "Isolated restore drill" },
    body: {
      zh: "尚未执行恢复、订单/权限完整性检查、耗时记录或演练环境销毁。",
      en: "No restore, order and permission integrity check, duration record, or drill-environment teardown has been performed.",
    },
  },
};

type ReadinessState =
  | "DEFINED_LOCAL_CONFIG"
  | "DEFINED_INFRA"
  | "NOT_A_BACKUP"
  | "NOT_DEPLOYED"
  | "NOT_IMPLEMENTED"
  | "NOT_DEFINED"
  | "NOT_PERFORMED";

const stateLabel = (locale: Locale, state: ReadinessState): string => {
  if (state === "DEFINED_LOCAL_CONFIG") return copy(locale, "本地配置已定义", "Local config defined");
  if (state === "DEFINED_INFRA") return copy(locale, "基础设施已定义", "Infrastructure defined");
  if (state === "NOT_A_BACKUP") return copy(locale, "不是备份", "Not a backup");
  if (state === "NOT_DEPLOYED") return copy(locale, "未部署", "Not deployed");
  if (state === "NOT_IMPLEMENTED") return copy(locale, "未开发", "Not implemented");
  if (state === "NOT_PERFORMED") return copy(locale, "未演练", "Not performed");
  return copy(locale, "未定义", "Not defined");
};

const stateClass = (state: ReadinessState): string =>
  `is-${state.toLowerCase().replaceAll("_", "-")}`;

export default function BackupReadinessPage({
  locale,
  onOpenDataSecurity,
  onOpenSettings,
}: {
  locale: Locale;
  onOpenDataSecurity: () => void;
  onOpenSettings: () => void;
}) {
  const readiness = useMemo(() => buildBackupReadiness(), []);

  return (
    <section className="backup-readiness-page">
      <div className="backup-readiness-truth-note" role="note">
        <WarningCircle size={20} aria-hidden="true" />
        <span>
          <strong>{copy(locale, "持久化不等于备份，模板定义不等于已经可恢复", "Persistence is not backup, and a template is not recoverability")}</strong>
          {copy(
            locale,
            "本页只陈述 `compose.yaml`、项目脚本、恢复规则和 AWS CDK 中能够核对的边界。它不读取数据库、卷或 AWS，不显示最近备份、大小、成功时间或恢复通过。",
            "This page only states boundaries verifiable in `compose.yaml`, project scripts, recovery rules, and AWS CDK. It does not read databases, volumes, or AWS, and it never shows a latest backup, size, success time, or passed restore.",
          )}
        </span>
      </div>

      <div className="backup-readiness-summary">
        <ReadinessStat
          detail={copy(locale, "同机持久化，不是备份", "Same-host persistence, not backup")}
          icon={HardDrives}
          label={copy(locale, "本地命名卷定义", "Local named-volume definitions")}
          value={String(readiness.localVolumeDefinitionCount)}
          tone="warning"
        />
        <ReadinessStat
          detail={copy(locale, "仅 CDK 代码证据", "CDK code evidence only")}
          icon={CloudArrowUp}
          label={copy(locale, "AWS 保护定义", "AWS protection definitions")}
          value={String(readiness.awsProtectionDefinitionCount)}
        />
        <ReadinessStat
          detail="NOT_IMPLEMENTED"
          icon={Archive}
          label={copy(locale, "本地自动备份任务", "Automated local backup jobs")}
          value={String(readiness.localBackupJobCount)}
          tone="warning"
        />
        <ReadinessStat
          detail="NOT_PERFORMED"
          icon={ArrowsClockwise}
          label={copy(locale, "真实恢复演练", "Real restore drills")}
          value={String(readiness.restoreDrillCount)}
          tone="warning"
        />
      </div>

      <div className="backup-readiness-toolbar">
        <p>
          <ShieldCheck size={17} aria-hidden="true" />
          {copy(
            locale,
            "不存在创建快照或开始恢复按钮；真实恢复必须先具备独立环境、负责人、验证清单和回滚手册。",
            "There are no create-snapshot or start-restore controls. A real restore first requires an isolated environment, owner, validation checklist, and rollback runbook.",
          )}
        </p>
        <button className="admin-secondary" onClick={onOpenSettings} type="button">
          <HardDrives size={17} aria-hidden="true" />
          {copy(locale, "打开系统设置", "Open system settings")}
        </button>
        <button className="admin-primary" onClick={onOpenDataSecurity} type="button">
          <ShieldCheck size={17} aria-hidden="true" />
          {copy(locale, "打开数据安全", "Open data security")}
        </button>
      </div>

      <div className="backup-readiness-resources">
        {readiness.resources.map((resource) => {
          const content = resourceCopy[resource.code];
          const Icon = content.icon;
          return (
            <article className="admin-panel backup-readiness-resource" key={resource.code}>
              <span><Icon size={22} aria-hidden="true" /></span>
              <div>
                <small>
                  {resource.environment === "LOCAL_DEVELOPMENT"
                    ? copy(locale, "本地开发边界", "LOCAL DEVELOPMENT BOUNDARY")
                    : copy(locale, "AWS 模板边界", "AWS TEMPLATE BOUNDARY")}
                </small>
                <h2>{content.title[locale]}</h2>
                <p>{content.body[locale]}</p>
              </div>
              <div className="backup-readiness-resource-meta">
                <div>
                  <small>{copy(locale, "位置 / 资源", "Location / resource")}</small>
                  <strong><code>{content.location}</code></strong>
                </div>
                <div>
                  <small>{copy(locale, "仓库证据", "Repository evidence")}</small>
                  <strong><code>{content.evidence}</code></strong>
                </div>
              </div>
              <div className="backup-readiness-resource-state">
                <span className={`backup-readiness-state ${stateClass(resource.persistenceState)}`}>
                  {stateLabel(locale, resource.persistenceState)}
                </span>
                <span className={`backup-readiness-state ${stateClass(resource.backupState)}`}>
                  {stateLabel(locale, resource.backupState)}
                </span>
              </div>
            </article>
          );
        })}
      </div>

      <div className="backup-readiness-main-grid">
        <section className="admin-panel backup-readiness-controls">
          <PanelHeading
            body={copy(locale, "这些状态只证明仓库定义存在，不证明备份已运行或可恢复。", "These states prove repository definitions only, not a running or recoverable backup.")}
            eyebrow={copy(locale, "当前保护", "CURRENT PROTECTIONS")}
            state={copy(locale, "代码边界", "Code boundaries")}
            stateClass="is-defined-infra"
            title={copy(locale, "已经写入配置的保护", "Protections already defined in configuration")}
          />
          <ol>
            {readiness.controls.map((control) => {
              const content = controlCopy[control.code];
              const Icon = content.icon;
              return (
                <li key={control.code}>
                  <span><Icon size={19} aria-hidden="true" /></span>
                  <div>
                    <strong>{content.title[locale]}</strong>
                    <p>{content.body[locale]}</p>
                    <code>{content.evidence}</code>
                  </div>
                  <span className={`backup-readiness-state ${stateClass(control.state)}`}>
                    {stateLabel(locale, control.state)}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="admin-panel backup-readiness-limitations">
          <PanelHeading
            body={copy(locale, "缺少证据时保持未采集、未部署或未演练。", "Missing evidence remains not collected, not deployed, or not performed.")}
            eyebrow={copy(locale, "当前限制", "CURRENT LIMITATIONS")}
            state={copy(locale, "运行未查询", "Runtime not queried")}
            stateClass="is-not-deployed"
            title={copy(locale, "不能从页面推断的结果", "Results this page cannot infer")}
          />
          <dl>
            <div>
              <dt>{copy(locale, "当前 Docker 容器健康", "Current Docker container health")}</dt>
              <dd>{copy(locale, "页面未查询", "Not queried by page")}</dd>
            </div>
            <div>
              <dt>{copy(locale, "本地备份文件", "Local backup artifacts")}</dt>
              <dd>{copy(locale, "仓库中无任务", "No repository job")}</dd>
            </div>
            <div>
              <dt>{copy(locale, "AWS 备份与快照", "AWS backups and snapshots")}</dt>
              <dd>{copy(locale, "未部署", "Not deployed")}</dd>
            </div>
            <div>
              <dt>{copy(locale, "最近备份时间、大小与校验和", "Latest backup time, size, and checksum")}</dt>
              <dd>{copy(locale, "未采集", "Not collected")}</dd>
            </div>
            <div>
              <dt>{copy(locale, "时间点恢复可用性", "Point-in-time recovery availability")}</dt>
              <dd>{copy(locale, "未核验", "Not verified")}</dd>
            </div>
            <div>
              <dt>{copy(locale, "恢复耗时与完整性", "Restore duration and integrity")}</dt>
              <dd>{copy(locale, "未演练", "Not performed")}</dd>
            </div>
            <div>
              <dt>{copy(locale, "RPO ≤ 5 分钟", "RPO ≤ 5 minutes")}</dt>
              <dd>{copy(locale, "未来目标，未批准", "Future target, not approved")}</dd>
            </div>
            <div>
              <dt>{copy(locale, "RTO ≤ 60 分钟", "RTO ≤ 60 minutes")}</dt>
              <dd>{copy(locale, "未来目标，未验证", "Future target, not verified")}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="admin-panel backup-readiness-records">
        <div className="backup-readiness-records-heading">
          <div>
            <small>{copy(locale, "资源定义清单", "RESOURCE DEFINITION INVENTORY")}</small>
            <h2>{copy(locale, "四个数据持久化与备份边界", "Four persistence and backup boundaries")}</h2>
            <p>{copy(locale, "每个定义保持单行；没有任何一行代表当前备份实例。", "Each definition remains one line; no row represents a current backup instance.")}</p>
          </div>
          <span>4 DEFINITIONS</span>
        </div>
        <div
          aria-label={copy(locale, "备份资源定义表，可横向滚动", "Backup resource definition table, horizontally scrollable")}
          className="backup-readiness-table-wrap"
          role="region"
          tabIndex={0}
        >
          <table className="backup-readiness-table">
            <thead>
              <tr>
                <th>{copy(locale, "资源代码", "Resource code")}</th>
                <th>{copy(locale, "环境", "Environment")}</th>
                <th>{copy(locale, "数据范围", "Data scope")}</th>
                <th>{copy(locale, "仓库来源", "Repository source")}</th>
                <th>{copy(locale, "持久化状态", "Persistence")}</th>
                <th>{copy(locale, "备份状态", "Backup state")}</th>
                <th>{copy(locale, "保留定义", "Retention definition")}</th>
                <th>{copy(locale, "恢复证据", "Restore evidence")}</th>
              </tr>
            </thead>
            <tbody>
              {readiness.resources.map((resource) => (
                <tr key={resource.code}>
                  <td><code>{resource.code}</code></td>
                  <td><code>{resource.environment}</code></td>
                  <td><code>{resource.dataScope}</code></td>
                  <td><code>{resource.repositorySource}</code></td>
                  <td>
                    <span className={`backup-readiness-state ${stateClass(resource.persistenceState)}`}>
                      {stateLabel(locale, resource.persistenceState)}
                    </span>
                  </td>
                  <td>
                    <span className={`backup-readiness-state ${stateClass(resource.backupState)}`}>
                      {stateLabel(locale, resource.backupState)}
                    </span>
                  </td>
                  <td><code>{resource.retentionDefinition}</code></td>
                  <td>
                    <span className={`backup-readiness-state ${stateClass(resource.restoreEvidence)}`}>
                      {stateLabel(locale, resource.restoreEvidence)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-panel backup-readiness-gates">
        <PanelHeading
          body={copy(locale, "未部署、未开发、未定义和未演练保持为不同状态。", "Not deployed, not implemented, not defined, and not performed remain distinct states.")}
          eyebrow={copy(locale, "上线门槛", "LAUNCH GATES")}
          state={copy(locale, "八项待完成", "Eight gates open")}
          stateClass="is-not-defined"
          title={copy(locale, "真正可恢复之前仍需完成", "Required before recoverability can be claimed")}
        />
        <ol>
          {readiness.gates.map((gate, index) => {
            const content = gateCopy[gate.code];
            return (
              <li key={gate.code}>
                <span className={`backup-readiness-gate-icon ${stateClass(gate.state)}`}>
                  {gate.state === "NOT_PERFORMED"
                    ? <ArrowsClockwise size={18} aria-hidden="true" />
                    : gate.state === "NOT_DEPLOYED"
                      ? <CloudArrowUp size={18} aria-hidden="true" />
                      : <WarningCircle size={18} aria-hidden="true" />}
                </span>
                <div>
                  <small>{String(index + 1).padStart(2, "0")}</small>
                  <strong>{content.title[locale]}</strong>
                  <p>{content.body[locale]}</p>
                </div>
                <span className={`backup-readiness-state ${stateClass(gate.state)}`}>
                  {stateLabel(locale, gate.state)}
                </span>
              </li>
            );
          })}
        </ol>
      </section>
    </section>
  );
}

function ReadinessStat({
  detail,
  icon: Icon,
  label,
  tone,
  value,
}: {
  detail: string;
  icon: IconComponent;
  label: string;
  tone?: "warning";
  value: string;
}) {
  return (
    <article className={`backup-readiness-stat${tone ? ` is-${tone}` : ""}`}>
      <span><Icon size={20} aria-hidden="true" /></span>
      <small>{label}</small>
      <strong>{value}</strong>
      <em>{detail}</em>
    </article>
  );
}

function PanelHeading({
  body,
  eyebrow,
  state,
  stateClass: stateTone,
  title,
}: {
  body: string;
  eyebrow: string;
  state: string;
  stateClass: string;
  title: string;
}) {
  return (
    <div className="backup-readiness-panel-heading">
      <div>
        <small>{eyebrow}</small>
        <h2>{title}</h2>
        <p>{body}</p>
      </div>
      <span className={`backup-readiness-state ${stateTone}`}>{state}</span>
    </div>
  );
}
