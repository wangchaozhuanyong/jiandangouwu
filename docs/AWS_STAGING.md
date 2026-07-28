# CloudBridge AWS staging 规划与费用门禁

## 当前状态

- `infra/` 已实现 AWS CDK 模板并通过本地 `synth`；当前没有创建 AWS 资源，也没有产生本模板对应的云费用。
- 区域固定为新加坡 `ap-southeast-1`。
- 当前模板按高可用 staging 设计：两个可用区、两个 NAT Gateway、每个应用两个 ECS Fargate 任务、RDS MySQL Multi-AZ、双节点 Valkey、ALB、WAF、CloudWatch、Secrets Manager 和 S3 访问日志。
- 任何 `cdk deploy`、DNS 修改、证书申请或数据迁移都需要用户再次明确授权。

## 低流量月费预估

以下按每月 730 小时、按需价格和低流量估算，币种为 USD。价格查询日期为 2026-07-27；AWS 价格、税费、流量和汇率会变化，部署前必须在 AWS Pricing Calculator 中重新核对。

| 项目 | 当前模板规格 | 估算/月 |
| --- | --- | ---: |
| ECS Fargate ARM | API 2 × 0.5 vCPU/1 GB；客户端和后台各 2 × 0.25 vCPU/0.5 GB | $71.96 |
| RDS MySQL | `db.t4g.medium` Multi-AZ + 50 GB gp3 | $161.99 |
| ElastiCache Valkey | 2 × `cache.t4g.small` | $56.06 |
| NAT Gateway | 2 个可用区，未含处理流量 | 约 $86.14 |
| Application Load Balancer | 1 个，未含实际 LCU | $18.40 起 |
| AWS WAF | 1 个 Web ACL、2 个托管规则组、1 个限速规则，未含请求量 | $8.00 起 |
| 公网 IPv4、Secrets Manager | 约 4 个公网 IPv4、4 个 Secret | 约 $16.20 |
| 日志、备份、S3、LCU、NAT/互联网流量 | 按真实用量 | 未计入 |

当前高可用模板的低流量基线约为 **$420–$460/月**，不含税、域名、超额备份、较高日志量和明显的互联网出站流量。RDS 自动扩容最高允许到 500 GB，实际扩容后费用会增加。

参考依据：

- [AWS Fargate 定价](https://aws.amazon.com/fargate/pricing/)：按 vCPU、内存和运行时长收费。
- [RDS for MySQL 定价](https://aws.amazon.com/rds/mysql/pricing/)：Multi-AZ 会计入主实例和备用实例，另计存储与备份。
- [ElastiCache 定价](https://aws.amazon.com/elasticache/pricing/)：节点模式按节点小时收费。
- [VPC/NAT Gateway 定价](https://aws.amazon.com/vpc/pricing/)：按 Gateway 小时和处理流量收费，并可能产生数据传输费。
- [Application Load Balancer 定价](https://aws.amazon.com/elasticloadbalancing/pricing/)：按运行小时和 LCU 收费。
- [AWS WAF 定价](https://aws.amazon.com/waf/pricing/)：按 Web ACL、规则和请求量收费。

如果用户优先控制费用，可以另做“单任务、单可用区、单数据库”的精简测试环境；它会显著降低月费，但失去当前模板的自动故障切换能力，不能在未确认风险时替换当前高可用方案。

## 创建前必填信息

- AWS 账户与 staging 费用预算。
- staging 完整域名，例如 `staging.example.com`。
- 同一区域 ACM 证书 ARN。
- 正式环境首位管理员的受控创建流程与初始密码交付负责人；当前本地首次设置入口在生产环境自动关闭。
- 告警接收人、账单预算告警阈值和资源标签负责人。
- 是否接受约 $420–$460/月的高可用基线，或单独批准精简环境重构。
- 重新执行 `npm audit --omit=dev`；当前 6 项上游 high 公告必须已有稳定补丁、明确缓解措施或逐项风险批准。

## 安全部署顺序

1. 在目标账户运行 CDK bootstrap，并先执行 `cdk diff` 审核计费资源、IAM 和保留策略。
2. 创建基础设施，但保持公开流量未切换。
3. 使用输出的 API task definition 启动一次性 migration task，执行 `npm run db:migrate:deploy`。
4. 验证迁移成功后启动/检查 API、客户端和后台健康状态。
5. 通过受控运维流程创建首位管理员，使用高强度密码登录，并按组织策略决定是否启用 TOTP 双重验证。
6. 检查 WAF、ALB 日志、RDS 备份、Valkey TLS、CloudWatch 告警和删除保护。
7. 最后修改 DNS，完成中英文、桌面、390px、订单和后台权限验收。

## 回滚与删除边界

- ECS 使用部署熔断自动回滚应用版本。
- RDS、ALB 和日志桶启用删除保护或 `RETAIN`，堆栈删除不会自动清除全部计费资源。
- 迁移只能使用已审查且向前兼容的 Prisma migration；数据库回滚依赖快照和恢复演练，不能假定 `down` migration 安全。
- 删除 staging 前必须逐项确认 RDS 快照、保留的 S3 bucket、Secrets、EIP/NAT Gateway 和 CloudWatch 日志，避免遗留费用。
