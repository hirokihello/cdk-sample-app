#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/core');
import { CdkSampleStack } from '../lib/cdk-sample-stack';
require('dotenv').config()

const app = new cdk.App();
new CdkSampleStack(app, 'CdkSampleStack', { env: {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'ap-northeast-1'
}});

app.synth()
