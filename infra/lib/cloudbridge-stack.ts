import {
  CfnOutput,
  CfnParameter,
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps,
} from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elasticache from "aws-cdk-lib/aws-elasticache";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as logs from "aws-cdk-lib/aws-logs";
import * as rds from "aws-cdk-lib/aws-rds";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import type { Construct } from "constructs";
import { fileURLToPath } from "node:url";

export class CloudBridgeStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    if (this.region !== "ap-southeast-1") {
      throw new Error("CloudBridge staging must be synthesized for ap-southeast-1 (Singapore).");
    }

    const domainName = new CfnParameter(this, "DomainName", {
      type: "String",
      description: "Staging hostname with DNS pointing to the ALB, for example staging.example.com",
      allowedPattern: "^(?=.{4,253}$)([A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\\.)+[A-Za-z]{2,63}$",
    });
    const certificateArn = new CfnParameter(this, "CertificateArn", {
      type: "String",
      description: "ACM certificate ARN in ap-southeast-1 for DomainName",
      allowedPattern: "^arn:aws:acm:ap-southeast-1:[0-9]{12}:certificate/[A-Za-z0-9-]+$",
    });
    const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
    const vpc = new ec2.Vpc(this, "Vpc", {
      ipAddresses: ec2.IpAddresses.cidr("10.42.0.0/16"),
      maxAzs: 2,
      natGateways: 2,
      subnetConfiguration: [
        { name: "public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: "application", subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
        { name: "data", subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
    });
    vpc.addFlowLog("RejectedTraffic", {
      trafficType: ec2.FlowLogTrafficType.REJECT,
      destination: ec2.FlowLogDestination.toCloudWatchLogs(
        new logs.LogGroup(this, "VpcFlowLogs", {
          retention: logs.RetentionDays.ONE_MONTH,
          removalPolicy: RemovalPolicy.DESTROY,
        }),
      ),
    });

    const albSecurityGroup = new ec2.SecurityGroup(this, "AlbSecurityGroup", {
      vpc,
      description: "Public HTTPS ingress to CloudBridge staging",
      allowAllOutbound: true,
    });
    albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), "Public HTTPS");
    albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "HTTP redirect");

    const applicationSecurityGroup = new ec2.SecurityGroup(this, "ApplicationSecurityGroup", {
      vpc,
      description: "Only the CloudBridge ALB can reach application tasks",
      allowAllOutbound: true,
    });
    applicationSecurityGroup.addIngressRule(albSecurityGroup, ec2.Port.tcp(3000), "Storefront from ALB");
    applicationSecurityGroup.addIngressRule(albSecurityGroup, ec2.Port.tcp(3001), "API from ALB");
    applicationSecurityGroup.addIngressRule(albSecurityGroup, ec2.Port.tcp(8080), "Admin from ALB");

    const databaseSecurityGroup = new ec2.SecurityGroup(this, "DatabaseSecurityGroup", {
      vpc,
      description: "MySQL access from CloudBridge tasks only",
      allowAllOutbound: false,
    });
    databaseSecurityGroup.addIngressRule(applicationSecurityGroup, ec2.Port.tcp(3306), "MySQL from API");

    const cacheSecurityGroup = new ec2.SecurityGroup(this, "CacheSecurityGroup", {
      vpc,
      description: "Valkey access from CloudBridge tasks only",
      allowAllOutbound: false,
    });
    cacheSecurityGroup.addIngressRule(applicationSecurityGroup, ec2.Port.tcp(6379), "Valkey from API");

    const database = new rds.DatabaseInstance(this, "Database", {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [databaseSecurityGroup],
      engine: rds.DatabaseInstanceEngine.mysql({
        version: rds.MysqlEngineVersion.VER_8_4_10,
      }),
      credentials: rds.Credentials.fromGeneratedSecret("cloudbridge_admin", {
        secretName: "cloudbridge/staging/mysql",
      }),
      databaseName: "cloudbridge",
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE4_GRAVITON, ec2.InstanceSize.MEDIUM),
      allocatedStorage: 50,
      maxAllocatedStorage: 500,
      storageType: rds.StorageType.GP3,
      storageEncrypted: true,
      multiAz: true,
      publiclyAccessible: false,
      autoMinorVersionUpgrade: true,
      backupRetention: Duration.days(7),
      deleteAutomatedBackups: false,
      deletionProtection: true,
      cloudwatchLogsExports: ["error", "general", "slowquery"],
      cloudwatchLogsRetention: logs.RetentionDays.ONE_MONTH,
      monitoringInterval: Duration.seconds(60),
      enablePerformanceInsights: true,
      performanceInsightRetention: rds.PerformanceInsightRetention.DEFAULT,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const cachePassword = new secretsmanager.Secret(this, "CachePassword", {
      secretName: "cloudbridge/staging/valkey-auth",
      generateSecretString: {
        passwordLength: 40,
        excludePunctuation: true,
      },
    });
    const cacheSubnetGroup = new elasticache.CfnSubnetGroup(this, "CacheSubnetGroup", {
      description: "CloudBridge staging Valkey subnets",
      subnetIds: vpc.isolatedSubnets.map((subnet) => subnet.subnetId),
    });
    const cache = new elasticache.CfnReplicationGroup(this, "Cache", {
      replicationGroupDescription: "CloudBridge staging sessions and TOTP flows",
      engine: "valkey",
      engineVersion: "8.0",
      cacheNodeType: "cache.t4g.small",
      numCacheClusters: 2,
      automaticFailoverEnabled: true,
      multiAzEnabled: true,
      atRestEncryptionEnabled: true,
      transitEncryptionEnabled: true,
      transitEncryptionMode: "required",
      authToken: cachePassword.secretValue.toString(),
      cacheSubnetGroupName: cacheSubnetGroup.ref,
      securityGroupIds: [cacheSecurityGroup.securityGroupId],
      snapshotRetentionLimit: 7,
      snapshotWindow: "18:00-19:00",
      preferredMaintenanceWindow: "sun:19:00-sun:20:00",
      autoMinorVersionUpgrade: true,
    });
    cache.addResourceDependency(cacheSubnetGroup);

    const sessionSecret = new secretsmanager.Secret(this, "SessionSecret", {
      secretName: "cloudbridge/staging/session-secret",
      generateSecretString: { passwordLength: 48, excludePunctuation: true },
    });
    const encryptionSecret = new secretsmanager.Secret(this, "EncryptionSecret", {
      secretName: "cloudbridge/staging/data-encryption-key",
      generateSecretString: { passwordLength: 48, excludePunctuation: true },
    });

    const cluster = new ecs.Cluster(this, "Cluster", {
      vpc,
      containerInsightsV2: ecs.ContainerInsights.ENABLED,
      enableFargateCapacityProviders: true,
    });
    const logGroup = new logs.LogGroup(this, "ApplicationLogs", {
      logGroupName: "/cloudbridge/staging/applications",
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const apiTask = new ecs.FargateTaskDefinition(this, "ApiTask", {
      cpu: 512,
      memoryLimitMiB: 1024,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.ARM64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });
    const apiContainer = apiTask.addContainer("Api", {
      image: ecs.ContainerImage.fromAsset(projectRoot, { file: "apps/api/Dockerfile" }),
      logging: ecs.LogDrivers.awsLogs({ logGroup, streamPrefix: "api" }),
      environment: {
        NODE_ENV: "production",
        API_PORT: "3001",
        DB_PORT: database.dbInstanceEndpointPort,
        DB_NAME: "cloudbridge",
        DB_TLS: "true",
        DB_ALLOW_PUBLIC_KEY_RETRIEVAL: "false",
        REDIS_HOST: cache.attrPrimaryEndPointAddress,
        REDIS_PORT: cache.attrPrimaryEndPointPort,
        REDIS_TLS: "true",
        API_PUBLIC_ORIGIN: `https://${domainName.valueAsString}`,
        ADMIN_ORIGIN: `https://${domainName.valueAsString}`,
        SESSION_COOKIE_NAME: "cloudbridge_admin_session",
      },
      secrets: {
        DB_HOST: ecs.Secret.fromSecretsManager(database.secret!, "host"),
        DB_USER: ecs.Secret.fromSecretsManager(database.secret!, "username"),
        DB_PASSWORD: ecs.Secret.fromSecretsManager(database.secret!, "password"),
        REDIS_PASSWORD: ecs.Secret.fromSecretsManager(cachePassword),
        SESSION_SECRET: ecs.Secret.fromSecretsManager(sessionSecret),
        AUTH_ENCRYPTION_KEY: ecs.Secret.fromSecretsManager(encryptionSecret),
      },
      healthCheck: {
        command: ["CMD-SHELL", "wget -qO- http://127.0.0.1:3001/v1/health || exit 1"],
        interval: Duration.seconds(30),
        timeout: Duration.seconds(5),
        retries: 3,
        startPeriod: Duration.seconds(45),
      },
    });
    apiContainer.addPortMappings({ containerPort: 3001, protocol: ecs.Protocol.TCP });
    database.secret?.grantRead(apiTask.taskRole);
    cachePassword.grantRead(apiTask.taskRole);
    sessionSecret.grantRead(apiTask.taskRole);
    encryptionSecret.grantRead(apiTask.taskRole);
    apiTask.node.addDependency(database, cache);

    const storefrontTask = new ecs.FargateTaskDefinition(this, "StorefrontTask", {
      cpu: 256,
      memoryLimitMiB: 512,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.ARM64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });
    const storefrontContainer = storefrontTask.addContainer("Storefront", {
      image: ecs.ContainerImage.fromAsset(projectRoot, { file: "apps/storefront/Dockerfile" }),
      logging: ecs.LogDrivers.awsLogs({ logGroup, streamPrefix: "storefront" }),
      environment: { NODE_ENV: "production", NEXT_PUBLIC_API_BASE_URL: "/v1" },
    });
    storefrontContainer.addPortMappings({ containerPort: 3000, protocol: ecs.Protocol.TCP });

    const adminTask = new ecs.FargateTaskDefinition(this, "AdminTask", {
      cpu: 256,
      memoryLimitMiB: 512,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.ARM64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });
    const adminContainer = adminTask.addContainer("Admin", {
      image: ecs.ContainerImage.fromAsset(projectRoot, { file: "apps/admin/Dockerfile" }),
      logging: ecs.LogDrivers.awsLogs({ logGroup, streamPrefix: "admin" }),
    });
    adminContainer.addPortMappings({ containerPort: 8080, protocol: ecs.Protocol.TCP });

    const commonService = {
      cluster,
      desiredCount: 2,
      assignPublicIp: false,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [applicationSecurityGroup],
      circuitBreaker: { rollback: true },
      enableExecuteCommand: false,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
    };
    const apiService = new ecs.FargateService(this, "ApiService", {
      ...commonService,
      taskDefinition: apiTask,
      serviceName: "cloudbridge-staging-api",
    });
    const storefrontService = new ecs.FargateService(this, "StorefrontService", {
      ...commonService,
      taskDefinition: storefrontTask,
      serviceName: "cloudbridge-staging-storefront",
    });
    const adminService = new ecs.FargateService(this, "AdminService", {
      ...commonService,
      taskDefinition: adminTask,
      serviceName: "cloudbridge-staging-admin",
    });
    for (const service of [apiService, storefrontService, adminService]) {
      service.autoScaleTaskCount({ minCapacity: 2, maxCapacity: 6 }).scaleOnCpuUtilization("CpuScaling", {
        targetUtilizationPercent: 65,
        scaleInCooldown: Duration.minutes(5),
        scaleOutCooldown: Duration.minutes(1),
      });
    }

    const loadBalancer = new elbv2.ApplicationLoadBalancer(this, "LoadBalancer", {
      vpc,
      internetFacing: true,
      securityGroup: albSecurityGroup,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      deletionProtection: true,
      dropInvalidHeaderFields: true,
    });
    const accessLogsBucket = new s3.Bucket(this, "AccessLogsBucket", {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      lifecycleRules: [{ expiration: Duration.days(90) }],
      removalPolicy: RemovalPolicy.RETAIN,
    });
    loadBalancer.logAccessLogs(accessLogsBucket);
    const certificate = acm.Certificate.fromCertificateArn(this, "Certificate", certificateArn.valueAsString);
    loadBalancer.addRedirect({ sourceProtocol: elbv2.ApplicationProtocol.HTTP, sourcePort: 80, targetProtocol: elbv2.ApplicationProtocol.HTTPS, targetPort: 443 });
    const listener = loadBalancer.addListener("Https", {
      port: 443,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      certificates: [certificate],
      sslPolicy: elbv2.SslPolicy.RECOMMENDED_TLS,
      defaultAction: elbv2.ListenerAction.fixedResponse(404, {
        contentType: "text/plain",
        messageBody: "Not found",
      }),
    });

    const apiTarget = listener.addTargets("ApiTarget", {
      priority: 10,
      conditions: [elbv2.ListenerCondition.pathPatterns(["/v1", "/v1/*"])],
      protocol: elbv2.ApplicationProtocol.HTTP,
      port: 3001,
      targets: [apiService],
      deregistrationDelay: Duration.seconds(30),
      healthCheck: {
        path: "/v1/health",
        healthyHttpCodes: "200",
        interval: Duration.seconds(30),
      },
    });
    listener.addTargets("AdminTarget", {
      priority: 20,
      conditions: [elbv2.ListenerCondition.pathPatterns(["/admin", "/admin/*"])],
      protocol: elbv2.ApplicationProtocol.HTTP,
      port: 8080,
      targets: [adminService],
      deregistrationDelay: Duration.seconds(20),
      healthCheck: {
        path: "/health",
        healthyHttpCodes: "200",
        interval: Duration.seconds(30),
      },
    });
    listener.addTargets("StorefrontTarget", {
      priority: 100,
      conditions: [elbv2.ListenerCondition.pathPatterns(["/*"])],
      protocol: elbv2.ApplicationProtocol.HTTP,
      port: 3000,
      targets: [storefrontService],
      deregistrationDelay: Duration.seconds(20),
      healthCheck: {
        path: "/zh",
        healthyHttpCodes: "200-399",
        interval: Duration.seconds(30),
      },
    });

    const webAcl = new wafv2.CfnWebACL(this, "WebAcl", {
      scope: "REGIONAL",
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: "CloudBridgeStagingWebAcl",
        sampledRequestsEnabled: true,
      },
      rules: [
        {
          name: "AwsCommonRules",
          priority: 10,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesCommonRuleSet",
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "AwsCommonRules",
            sampledRequestsEnabled: true,
          },
        },
        {
          name: "KnownBadInputs",
          priority: 20,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesKnownBadInputsRuleSet",
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "KnownBadInputs",
            sampledRequestsEnabled: true,
          },
        },
        {
          name: "GlobalRateLimit",
          priority: 30,
          action: { block: {} },
          statement: {
            rateBasedStatement: {
              aggregateKeyType: "IP",
              limit: 2000,
              evaluationWindowSec: 300,
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "GlobalRateLimit",
            sampledRequestsEnabled: true,
          },
        },
      ],
    });
    new wafv2.CfnWebACLAssociation(this, "WebAclAssociation", {
      resourceArn: loadBalancer.loadBalancerArn,
      webAclArn: webAcl.attrArn,
    });

    new cloudwatch.Alarm(this, "Alb5xxAlarm", {
      metric: loadBalancer.metrics.httpCodeElb(elbv2.HttpCodeElb.ELB_5XX_COUNT, {
        period: Duration.minutes(5),
        statistic: "sum",
      }),
      threshold: 5,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    new cloudwatch.Alarm(this, "ApiUnhealthyAlarm", {
      metric: apiTarget.metrics.unhealthyHostCount({ period: Duration.minutes(1), statistic: "max" }),
      threshold: 1,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
    });
    new cloudwatch.Alarm(this, "DatabaseCpuAlarm", {
      metric: database.metricCPUUtilization({ period: Duration.minutes(5) }),
      threshold: 80,
      evaluationPeriods: 3,
    });

    new CfnOutput(this, "StagingUrl", { value: `https://${domainName.valueAsString}` });
    new CfnOutput(this, "AdminUrl", { value: `https://${domainName.valueAsString}/admin/` });
    new CfnOutput(this, "LoadBalancerDnsName", { value: loadBalancer.loadBalancerDnsName });
    new CfnOutput(this, "MigrationTaskDefinitionArn", { value: apiTask.taskDefinitionArn });
    new CfnOutput(this, "MigrationCommand", { value: "npm run db:migrate:deploy" });
  }
}
