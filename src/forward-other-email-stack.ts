import type { StackProps } from 'aws-cdk-lib';
import { Duration, Stack } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import type { Construct } from 'constructs';

/**
 * CDK stack definition: declares the Lambda function and its IAM role binding
 * as infrastructure-as-code. Instantiating this class builds an in-memory
 * construct tree. It doesn't call AWS APIs or deploy anything. `cdk synth`
 * (driven by src/main.ts) walks that tree and renders it into a
 * CloudFormation template; `cdk deploy` then applies that template.
 *
 * Importing this file has no side effects, which is what lets tests
 * instantiate the stack directly (see test/main.test.ts).
 */
export class ForwardOtherEmailStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    const roleArn = process.env.LAMBDA_ROLE_ARN;
    if (!roleArn) {
      throw new Error('LAMBDA_ROLE_ARN environment variable is required');
    }

    const role = iam.Role.fromRoleArn(this, 'LambdaRole', roleArn);

    new NodejsFunction(this, 'ForwardEmailFunction', {
      functionName: 'forward-other-email',
      entry: 'src/handler.ts',
      handler: 'handler',
      runtime: Runtime.NODEJS_22_X,
      role,
      memorySize: 128,
      timeout: Duration.seconds(30),
      environment: {
        SECRET_NAME: 'forward-other-email-secrets',
      },
      bundling: {
        externalModules: ['@aws-sdk/*'],
      },
    });
  }
}
