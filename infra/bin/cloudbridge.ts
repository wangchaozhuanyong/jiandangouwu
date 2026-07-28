#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { CloudBridgeStack } from "../lib/cloudbridge-stack.js";

const app = new cdk.App();

new CloudBridgeStack(app, "CloudBridgeStaging", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "ap-southeast-1",
  },
  description: "CloudBridge staging commerce platform in AWS Singapore",
});
