param([string]$Profile = 'aws-course', [string]$Region = 'ap-southeast-2')
$ErrorActionPreference = 'Stop'
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
  $planText = aws freetier get-account-plan-state --region us-east-1 --profile $Profile --output json --no-cli-pager
  if ($LASTEXITCODE -ne 0) { throw 'Account check failed. Check aws login.' }
  $plan = $planText | ConvertFrom-Json
  if ($plan.accountPlanType -ne 'FREE' -or $plan.accountPlanStatus -ne 'ACTIVE') {
    throw 'This learning workflow requires an active FREE plan. No changeset created.'
  }
  $clusterText = aws rds describe-db-clusters --db-cluster-identifier octoshelf-free-db --region $Region --profile $Profile --output json --no-cli-pager
  if ($LASTEXITCODE -ne 0) { throw 'Cannot read the existing Aurora cluster.' }
  $database = ($clusterText | ConvertFrom-Json).DBClusters[0]
  if (!$database.Endpoint -or !$database.DbClusterResourceId -or $database.Engine -ne 'aurora-postgresql') {
    throw 'Expected an existing Aurora PostgreSQL cluster.'
  }
  npm run build:lambda
  if ($LASTEXITCODE -ne 0) { throw 'Lambda build failed.' }
  sam validate --lint --template-file infrastructure/free-api.yaml --region $Region --profile $Profile
  if ($LASTEXITCODE -ne 0) { throw 'Template validation failed.' }
  Write-Host 'Creating preview only. S3 code upload may consume credits.'
  $previewArgs = @(
    'deploy', '--template-file', 'infrastructure/free-api.yaml',
    '--stack-name', 'octoshelf-free-api', '--region', $Region, '--profile', $Profile,
    '--resolve-s3', '--capabilities', 'CAPABILITY_IAM', '--no-execute-changeset',
    '--parameter-overrides', "DatabaseHost=$($database.Endpoint)",
    "DatabaseResourceId=$($database.DbClusterResourceId)", "DatabaseUser=$($database.MasterUsername)"
  )
  sam @previewArgs
  if ($LASTEXITCODE -ne 0) { throw 'Changeset preview failed.' }
} finally { Pop-Location }
