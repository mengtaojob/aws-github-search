import { handle } from '@hono/aws-lambda';
import { createApp } from './app';
// 同一业务应用由本地 HTTP server 和 AWS Lambda 共用。
export const handler = handle(createApp());
