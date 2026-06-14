import { App } from 'aws-cdk-lib';
import { ForwardOtherEmailStack } from './forward-other-email-stack';

const app = new App();
new ForwardOtherEmailStack(app, 'ses-forwarder-dev');
app.synth();
