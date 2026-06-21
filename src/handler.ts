import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import type { S3Event } from 'aws-lambda';
import { simpleParser } from 'mailparser';

interface SecretConfig {
  bucket: string;
  fromEmail: string;
  toEmail: string;
}

const ses = new SESv2Client({});
const s3 = new S3Client({});
const secretsManager = new SecretsManagerClient({});

let cachedConfig: SecretConfig | undefined;

// Fetches config once on first invocation and caches it for subsequent calls
const getConfig = async (): Promise<SecretConfig> => {
  if (!cachedConfig) {
    const result = await secretsManager.send(
      new GetSecretValueCommand({ SecretId: process.env.SECRET_NAME! }),
    );
    if (!result.SecretString) throw new Error('Secret has no string value');
    cachedConfig = JSON.parse(result.SecretString) as SecretConfig;
  }
  return cachedConfig;
};

const getS3File = async (bucket: string, key: string): Promise<Buffer> => {
  const response = await s3.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  if (!response.Body) throw new Error('S3 object has no body');
  return Buffer.from(await response.Body.transformToByteArray());
};

export const handler = async (event: S3Event): Promise<void> => {
  const config = await getConfig();
  const messageKey = event.Records[0].s3.object.key;
  console.log('Processing message: ', messageKey);

  const fileData = await getS3File(config.bucket, messageKey);
  const parsed = await simpleParser(fileData);
  const fromText = parsed.from?.text ?? '(unknown sender)';

  await ses.send(
    new SendEmailCommand({
      FromEmailAddress: config.fromEmail,
      Destination: { ToAddresses: [config.toEmail] },
      Content: {
        Simple: {
          Subject: { Data: parsed.subject ?? '(no subject)' },
          Body: {
            Text: { Data: `From: ${fromText}\n\n${parsed.text ?? ''}` },
            Html: parsed.html
              ? {
                  Data: `<p><strong>From:</strong> ${fromText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p><hr>${parsed.html}`,
                }
              : undefined,
          },
        },
      },
    }),
  );
  console.log('Email forwarded successfully to:', config.toEmail);
};
