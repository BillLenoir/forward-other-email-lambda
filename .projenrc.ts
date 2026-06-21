import { awscdk, github, javascript } from 'projen';
const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: '2.150.0',
  defaultReleaseBranch: 'main',
  name: 'ses-forwarder',
  packageManager: javascript.NodePackageManager.NPM,
  projenrcTs: true,
  gitignore: ['.env', '.claude/'],
  prettier: true,
  prettierOptions: {
    settings: {
      singleQuote: true,
    },
  },
  jestOptions: {
    jestConfig: {
      moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
      },
    },
  },
  buildWorkflowOptions: {
    env: {
      LAMBDA_ROLE_ARN: '${{ secrets.LAMBDA_ROLE_ARN }}',
    },
  },

  deps: [
    '@aws-sdk/client-s3',
    '@aws-sdk/client-secrets-manager',
    '@aws-sdk/client-sesv2',
    'mailparser',
  ],
  devDeps: [
    '@types/aws-lambda',
    'eslint-config-prettier',
    '@types/mailparser',
    'aws-sdk-client-mock',
    'aws-sdk-client-mock-jest',
  ],
});

project.eslint?.addRules({
  '@typescript-eslint/no-explicit-any': ['error'],
  '@typescript-eslint/consistent-type-imports': [
    'error',
    { prefer: 'type-imports' },
  ],
});

project.eslint?.addExtends('prettier');

const deployWorkflow = project.github?.addWorkflow('deploy');
deployWorkflow?.on({ workflowDispatch: {} });
deployWorkflow?.addJob('deploy', {
  runsOn: ['ubuntu-latest'],
  permissions: {
    idToken: github.workflows.JobPermission.WRITE,
    contents: github.workflows.JobPermission.READ,
  },
  env: {
    LAMBDA_ROLE_ARN: '${{ secrets.LAMBDA_ROLE_ARN }}',
  },
  steps: [
    { name: 'Checkout', uses: 'actions/checkout@v6' },
    { name: 'Install dependencies', run: 'npm ci' },
    {
      name: 'Configure AWS credentials',
      uses: 'aws-actions/configure-aws-credentials@v4',
      with: {
        'role-to-assume': '${{ secrets.AWS_DEPLOY_ROLE_ARN }}',
        'aws-region': 'us-east-1',
      },
    },
    {
      name: 'Deploy',
      run: 'npx projen deploy -- --require-approval never',
    },
  ],
});

project.synth();
