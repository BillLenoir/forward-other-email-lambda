import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { ForwardOtherEmailStack } from '../src/forward-other-email-stack';

describe('ForwardOtherEmailStack', () => {
  beforeEach(() => {
    process.env.LAMBDA_ROLE_ARN = 'arn:aws:iam::123456789:role/test-role';
  });

  it('matches the snapshot', () => {
    const app = new App();
    const stack = new ForwardOtherEmailStack(app, 'test');

    const template = Template.fromStack(stack);
    expect(template.toJSON()).toMatchSnapshot();
  });

  it('throws when LAMBDA_ROLE_ARN is not set', () => {
    delete process.env.LAMBDA_ROLE_ARN;

    const app = new App();
    expect(() => new ForwardOtherEmailStack(app, 'test')).toThrow(
      'LAMBDA_ROLE_ARN environment variable is required',
    );
  });
});
