import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import type { StreamingBlobPayloadOutputTypes } from '@smithy/types';
import type { S3Event } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-jest';
import { type ParsedMail, simpleParser } from 'mailparser';
import { handler } from '../src/handler';

jest.mock('mailparser');

const secretsMock = mockClient(SecretsManagerClient);
const s3Mock = mockClient(S3Client);
const sesMock = mockClient(SESv2Client);

const mockSimpleParser = simpleParser as jest.MockedFunction<
  typeof simpleParser
>;
const makeParsedMail = (overrides: Partial<ParsedMail>): ParsedMail => ({
  attachments: [],
  headers: new Map(),
  headerLines: [],
  html: false,
  ...overrides,
});

beforeEach(() => {
  secretsMock.reset();
  s3Mock.reset();
  sesMock.reset();
});

describe('handler', () => {
  describe('email forwarding', () => {
    it('forwards email with correct fromEmail, toEmail, and subject', async () => {
      secretsMock.on(GetSecretValueCommand).resolves({
        SecretString: JSON.stringify({
          bucket: 'test-bucket',
          fromEmail: 'from@test.com',
          toEmail: 'to@test.com',
        }),
      });

      s3Mock.on(GetObjectCommand).resolves({
        Body: {
          transformToByteArray: jest.fn().mockResolvedValue(new Uint8Array()),
        } as unknown as StreamingBlobPayloadOutputTypes,
      });

      mockSimpleParser.mockResolvedValue(
        makeParsedMail({ subject: 'Test Subject', text: 'Test body' }),
      );

      sesMock.on(SendEmailCommand).resolves({});

      const mockEvent = {
        Records: [{ s3: { object: { key: 'test-key' } } }],
      } as S3Event;

      await handler(mockEvent);
      expect(sesMock).toHaveReceivedCommandWith(SendEmailCommand, {
        FromEmailAddress: 'from@test.com',
        Destination: { ToAddresses: ['to@test.com'] },
        Content: expect.objectContaining({
          Simple: expect.objectContaining({
            Subject: { Data: 'Test Subject' },
          }),
        }),
      });
    });

    it('uses "(no subject)" when subject is missing', async () => {
      secretsMock.on(GetSecretValueCommand).resolves({
        SecretString: JSON.stringify({
          bucket: 'test-bucket',
          fromEmail: 'from@test.com',
          toEmail: 'to@test.com',
        }),
      });

      s3Mock.on(GetObjectCommand).resolves({
        Body: {
          transformToByteArray: jest.fn().mockResolvedValue(new Uint8Array()),
        } as unknown as StreamingBlobPayloadOutputTypes,
      });

      mockSimpleParser.mockResolvedValue(makeParsedMail({ text: 'Test body' }));

      sesMock.on(SendEmailCommand).resolves({});

      const mockEvent = {
        Records: [{ s3: { object: { key: 'test-key' } } }],
      } as S3Event;

      await handler(mockEvent);
      expect(sesMock).toHaveReceivedCommandWith(SendEmailCommand, {
        Content: expect.objectContaining({
          Simple: expect.objectContaining({
            Subject: { Data: '(no subject)' },
          }),
        }),
      });
    });
  });

  describe('error handling', () => {
    it('throws when S3 response.Body is null', () => {});

    it('propagates SES send errors', () => {});

    it('throws when SecretString is missing', () => {});
  });
});
