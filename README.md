# forward-other-email-lambda

An AWS Lambda function that receives emails via Amazon SES, retrieves the raw message from S3, parses it, and forwards it to a designated address. Built with TypeScript, AWS CDK, and AWS SDK v3.

## Architecture

```text
Incoming email
      │
      ▼
Amazon SES (receipt rule)
      │
      ├──► S3 (raw email stored)
      │
      └──► Lambda (this function)
                  │
                  ▼
           Secrets Manager
           (config fetch)
                  │
                  ▼
           Parse email
           (mailparser)
                  │
                  ▼
           Amazon SES
           (forward email)
```

## Prerequisites

- Node.js 22+
- AWS CLI
- AWS CDK (`npm install -g aws-cdk`)
- An AWS account with SES configured to receive email

## Local Setup

```bash
git clone https://github.com/your-username/forward-other-email-lambda.git
cd forward-other-email-lambda
npm install
cp .env.example .env
```

Edit `.env` with your values — see [Configuration](#configuration) below.

## AWS Setup

### 1. Bootstrap CDK

CDK requires a one-time bootstrap per AWS account/region:

```bash
npx cdk bootstrap --profile <your-admin-profile>
```

### 2. Create a deployer IAM user

Create a dedicated IAM user (`forward-other-email-deployer`) with an inline policy allowing it to assume the CDK bootstrap roles:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
      "Resource": [
        "arn:aws:iam::<account-id>:role/cdk-hnb659fds-deploy-role-<account-id>-<region>",
        "arn:aws:iam::<account-id>:role/cdk-hnb659fds-file-publishing-role-<account-id>-<region>",
        "arn:aws:iam::<account-id>:role/cdk-hnb659fds-lookup-role-<account-id>-<region>"
      ]
    }
  ]
}
```

Configure the AWS profile locally:

```bash
aws configure --profile forward-other-email-deployer
```

### 3. Create the Secrets Manager secret

Create a secret named `forward-other-email-secrets` with the following JSON structure:

```json
{
  "bucket": "<s3-bucket-name>",
  "fromEmail": "<verified-ses-sender-address>",
  "toEmail": "<forwarding-destination-address>"
}
```

## Deploy

```bash
export $(cat .env | xargs)
npx cdk deploy --profile forward-other-email-deployer
```

## Configuration

### `.env`

| Variable | Description |
| --- | --- |
| `LAMBDA_ROLE_ARN` | ARN of the existing Lambda execution role |
| `SECRET_NAME` | Name of the Secrets Manager secret |
| `AWS_PROFILE` | Local AWS profile used for deployment |

### Secrets Manager

| Key | Description |
| --- | --- |
| `bucket` | S3 bucket where SES stores incoming emails |
| `fromEmail` | Verified SES sender address used when forwarding |
| `toEmail` | Destination address for forwarded emails |
