import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({});
const cached = new Map<string, { value: string; expires: number }>();

export async function readSecret(arn: string): Promise<string> {
  const entry = cached.get(arn);
  if (entry && entry.expires > Date.now()) return entry.value;
  const result = await client.send(new GetSecretValueCommand({ SecretId: arn }));
  if (!result.SecretString) throw new Error('Secret has no string value');
  cached.set(arn, { value: result.SecretString, expires: Date.now() + 300_000 });
  return result.SecretString;
}

export async function accessToken(): Promise<string | undefined> {
  if (process.env.API_SECRET_ARN) return readSecret(process.env.API_SECRET_ARN);
  if (process.env.AWS_LAMBDA_FUNCTION_NAME && !process.env.API_ACCESS_TOKEN) {
    throw new Error('Lambda requires an API access token');
  }
  return process.env.API_ACCESS_TOKEN;
}
