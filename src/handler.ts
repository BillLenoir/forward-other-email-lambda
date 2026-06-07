import type { Callback, Context, S3Event } from 'aws-lambda';
import * as aws from 'aws-sdk';
import * as nodemailer from 'nodemailer';

// Gymnastics to avoid using any or double casting with unknown
// This allows me to sleep at night.
declare module 'nodemailer' {
  interface TransportOptions {
    SES?: AWS.SES;
  }
}

const ses = new aws.SES();
const s3 = new aws.S3();
const transporter = nodemailer.createTransport({
  SES: ses,
});

function getS3File(bucket: string, key: string) {
  return new Promise<AWS.S3.GetObjectOutput>(function (resolve, reject) {
    s3.getObject(
      {
        Bucket: bucket,
        Key: key,
      },
      function (err: AWS.AWSError | null, data: AWS.S3.GetObjectOutput) {
        if (err) return reject(err);
        else return resolve(data);
      },
    );
  });
}

export const handler = function (event: S3Event, _context: Context, callback: Callback) {

  const bucket = 'bil-email';
  const messageKey = event.Records[0].s3.object.key;

  getS3File(bucket, messageKey)
    .then(function (fileData: AWS.S3.GetObjectOutput) {
      const mailOptions = {
        from: 'forward@bill-lenoir.com',
        subject: 'Other Email',
        text: messageKey,
        to: 'bill@bill-lenoir.com',
        attachments: [
          {
            filename: messageKey,
            content: fileData.Body != null ? Buffer.from(fileData.Body as Uint8Array) : undefined,
          },
        ],
      };

      void transporter.sendMail(mailOptions, function (err: Error | null, _info: nodemailer.SentMessageInfo) {
        if (err) {
          console.log(err);
          console.log('Error sending email');
          callback(err);
        } else {
          console.log('Email sent successfully');
          callback();
        }
      });
    })
    .catch(function (error: unknown) {
      console.log(error);
      console.log('Error getting attachment from S3');
      callback(error instanceof Error ? error : new Error(String(error)));
    });
};
