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

// ParsedMail requires these fields; defaults satisfy the type so each
// test only needs to override what it cares about.
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

const mockConfig = {
  bucket: 'test-bucket',
  fromEmail: 'from@test.com',
  toEmail: 'to@test.com',
};

const mockEvent = {
  Records: [{ s3: { object: { key: 'test-key' } } }],
} as S3Event;

// The real StreamingBlobPayloadOutputTypes has more methods than
// handler.ts uses; this cast provides just transformToByteArray.
const mockS3Body = {
  transformToByteArray: jest.fn().mockResolvedValue(new Uint8Array()),
} as unknown as StreamingBlobPayloadOutputTypes;

describe('handler', () => {
  describe('email forwarding', () => {
    beforeEach(() => {
      secretsMock.on(GetSecretValueCommand).resolves({
        SecretString: JSON.stringify(mockConfig),
      });
      s3Mock.on(GetObjectCommand).resolves({ Body: mockS3Body });
      sesMock.on(SendEmailCommand).resolves({});
    });

    it('forwards email with correct fromEmail, toEmail, and subject', async () => {
      mockSimpleParser.mockResolvedValue(
        makeParsedMail({ subject: 'Test Subject', text: 'Test body' }),
      );

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
      mockSimpleParser.mockResolvedValue(makeParsedMail({ text: 'Test body' }));

      await handler(mockEvent);

      expect(sesMock).toHaveReceivedCommandWith(SendEmailCommand, {
        Content: expect.objectContaining({
          Simple: expect.objectContaining({
            Subject: { Data: '(no subject)' },
          }),
        }),
      });
    });

    it('omits Html when parsed email has no HTML', async () => {
      mockSimpleParser.mockResolvedValue(makeParsedMail({ text: 'Test body' }));

      await handler(mockEvent);

      // objectContaining compares actual.Html to undefined via normal property
      // access, so this matches whether Html is absent or explicitly undefined.
      // Both mean "no Html field was set."
      expect(sesMock).toHaveReceivedCommandWith(SendEmailCommand, {
        Content: expect.objectContaining({
          Simple: expect.objectContaining({
            Body: expect.objectContaining({
              Html: undefined,
            }),
          }),
        }),
      });
    });

    it('includes Html when parsed email has HTML', async () => {
      mockSimpleParser.mockResolvedValue(
        makeParsedMail({
          from: {
            text: 'Sender <sender@example.com>',
          } as unknown as ParsedMail['from'],
          text: 'Test body',
          html: '<p>Test body</p>',
        }),
      );

      await handler(mockEvent);

      expect(sesMock).toHaveReceivedCommandWith(SendEmailCommand, {
        Content: expect.objectContaining({
          Simple: expect.objectContaining({
            Body: expect.objectContaining({
              Html: {
                Data: '<p><strong>From:</strong> Sender &lt;sender@example.com&gt;</p><hr><p>Test body</p>',
              },
            }),
          }),
        }),
      });
    });

    it('includes original sender in text body', async () => {
      mockSimpleParser.mockResolvedValue(
        makeParsedMail({
          from: {
            text: 'Sender <sender@example.com>',
          } as unknown as ParsedMail['from'],
          text: 'Hello',
        }),
      );

      await handler(mockEvent);

      expect(sesMock).toHaveReceivedCommandWith(SendEmailCommand, {
        Content: expect.objectContaining({
          Simple: expect.objectContaining({
            Body: expect.objectContaining({
              Text: { Data: 'From: Sender <sender@example.com>\n\nHello' },
            }),
          }),
        }),
      });
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      secretsMock.on(GetSecretValueCommand).resolves({
        SecretString: JSON.stringify(mockConfig),
      });
      s3Mock.on(GetObjectCommand).resolves({ Body: mockS3Body });
      mockSimpleParser.mockResolvedValue(makeParsedMail({ text: 'Test body' }));
      sesMock.on(SendEmailCommand).resolves({});
    });

    it('throws when S3 response.Body is null', async () => {
      s3Mock.on(GetObjectCommand).resolves({});

      await expect(handler(mockEvent)).rejects.toThrow('S3 object has no body');
    });

    it('propagates SES send errors', async () => {
      sesMock.on(SendEmailCommand).rejects(new Error('SES failure'));

      await expect(handler(mockEvent)).rejects.toThrow('SES failure');
    });

    it('throws when SecretString is missing', async () => {
      // handler.ts caches its config in a module-level variable after the first
      // successful call, so by now getConfig() would just return the cached
      // value without calling SecretsManager again. isolateModulesAsync gives
      // us a fresh copy of handler.ts with that cache reset, but the fresh
      // copy also gets a fresh @aws-sdk/client-secrets-manager module, which
      // the outer secretsMock doesn't intercept. So we build a new mockClient
      // against the fresh SecretsManagerClient too.
      await jest.isolateModulesAsync(async () => {
        const { mockClient: freshMockClient } =
          await import('aws-sdk-client-mock');

        const {
          SecretsManagerClient: FreshSecretsManagerClient,
          GetSecretValueCommand: FreshGetSecretValueCommand,
        } = await import('@aws-sdk/client-secrets-manager');

        const freshSecretsMock = freshMockClient(FreshSecretsManagerClient);
        freshSecretsMock.on(FreshGetSecretValueCommand).resolves({});

        const { handler: freshHandler } = await import('../src/handler.js');

        await expect(freshHandler(mockEvent)).rejects.toThrow(
          'Secret has no string value',
        );
      });
    });
  });
});
