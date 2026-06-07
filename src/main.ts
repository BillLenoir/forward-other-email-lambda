import { App, Duration, Stack, StackProps } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';

export class ForwardOtherEmailStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    const roleArn = process.env.LAMBDA_ROLE_ARN;
    if (!roleArn) throw new Error('LAMBDA_ROLE_ARN environment variable is required');

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

const app = new App();
new ForwardOtherEmailStack(app, 'ses-forwarder-dev');
app.synth();
