import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { ForwardOtherEmailStack } from '../src/forward-other-email-stack';

process.env.LAMBDA_ROLE_ARN = 'arn:aws:iam::123456789:role/test-role';

describe('ForwardOtherEmailStack', () => {
  it('matches the snapshot', () => {
    const app = new App();
    const stack = new ForwardOtherEmailStack(app, 'test');

    const template = Template.fromStack(stack);
    expect(template.toJSON()).toMatchSnapshot();
  });
});
