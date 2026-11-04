import { execFile } from 'node:child_process';
import { parseArgs, promisify } from 'node:util';

const { values } = parseArgs({ options: {
  profile: { type: 'string', default: 'aws-course' },
  help: { type: 'boolean', short: 'h' },
} });

if (values.help) {
  console.log('Usage: node scripts/aws-preflight.mjs --profile aws-course');
  console.log('Read-only account-plan check for this project\'s standard VPC Aurora template.');
} else {
  try {
    const { stdout } = await promisify(execFile)(process.platform === 'win32' ? 'aws.exe' : 'aws', [
      'freetier', 'get-account-plan-state', '--region', 'us-east-1', '--profile', values.profile,
      '--output', 'json', '--no-cli-pager', '--cli-connect-timeout', '10', '--cli-read-timeout', '20',
    ], { timeout: 45_000, windowsHide: true });
    const plan = JSON.parse(stdout);
    console.log(`AWS account plan: ${plan.accountPlanType}; status: ${plan.accountPlanStatus}`);
    if (plan.accountPlanType === 'FREE') {
      console.error('STOP: This template creates Aurora in a VPC. The Free plan requires Aurora Express, which cannot be attached to a VPC.');
      console.error('Choose a compatible account plan or agree on a different course architecture before deploying.');
      process.exitCode = 2;
    } else if (plan.accountPlanType !== 'PAID' || plan.accountPlanStatus !== 'ACTIVE') {
      console.error('STOP: Account-plan compatibility is not confirmed. Check the account before deploying.');
      process.exitCode = 2;
    } else {
      console.log('Account-plan check passed. This does not verify all resource quotas, deployment permissions, or available credits.');
      console.log('Deployment can incur charges; review the resource changeset and costs before executing it.');
    }
  } catch (error) {
    console.error('Cannot verify AWS account plan:', error.message);
    console.error('Check AWS CLI login and freetier:GetAccountPlanState permission before deploying.');
    process.exitCode = 1;
  }
}
