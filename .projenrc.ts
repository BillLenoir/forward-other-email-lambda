import { awscdk, javascript } from 'projen';
const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: '2.150.0',
  defaultReleaseBranch: 'main',
  name: 'ses-forwarder',
  packageManager: javascript.NodePackageManager.NPM,
  projenrcTs: true,
  gitignore: ['.env', '.claude/'],
  prettier: true,

  deps: ['@aws-sdk/client-s3', '@aws-sdk/client-secrets-manager', '@aws-sdk/client-sesv2', 'mailparser'],
  devDeps: ['@types/aws-lambda', 'eslint-config-prettier', '@types/mailparser'],
});

project.eslint?.addRules({
  '@typescript-eslint/no-explicit-any': ['error'],
  '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
});

project.eslint?.addExtends('prettier');
project.synth();
