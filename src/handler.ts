import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
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

// Resolved once at cold start and cached for subsequent invocations
const configPromise: Promise<SecretConfig> = secretsManager
  .send(new GetSecretValueCommand({ SecretId: process.env.SECRET_NAME! }))
  .then(result => {
    if (!result.SecretString) throw new Error('Secret has no string value');
    return JSON.parse(result.SecretString) as SecretConfig;
  });

async function getS3File(bucket: string, key: string): Promise<Buffer> {
  const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!response.Body) throw new Error('S3 object has no body');
  return Buffer.from(await response.Body.transformToByteArray());
}

export const handler = async function (event: S3Event): Promise<void> {
  const config = await configPromise;
  const messageKey = event.Records[0].s3.object.key;
  console.log('Processing message: ', messageKey);

  const fileData = await getS3File(config.bucket, messageKey);
  const parsed = await simpleParser(fileData);

  await ses.send(new SendEmailCommand({
    FromEmailAddress: config.fromEmail,
    Destination: { ToAddresses: [config.toEmail] },
    Content: {
      Simple: {
        Subject: { Data: parsed.subject ?? '(no subject)' },
        Body: {
          Text: { Data: parsed.text ?? '' },
          Html: parsed.html ? { Data: parsed.html } : undefined,
        },
      },
    },
  }));
  console.log('Email forwarded successfully to:', config.toEmail);

};
