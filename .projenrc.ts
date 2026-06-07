import { awscdk, javascript } from 'projen';
const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: '2.150.0',
  defaultReleaseBranch: 'main',
  name: 'ses-forwarder',
  packageManager: javascript.NodePackageManager.NPM,
  projenrcTs: true,
  gitignore: ['.env'],
  prettier: true,

  deps: ['aws-sdk', 'nodemailer'],
  devDeps: ['@types/nodemailer', '@types/aws-lambda', 'eslint-config-prettier'],
});

project.eslint?.addRules({
  '@typescript-eslint/no-explicit-any': ['error'],
  '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
});

project.eslint?.addExtends('prettier');
project.synth();
