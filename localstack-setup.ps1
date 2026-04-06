# Guia rapido: LocalStack + DynamoDB para este projeto
# Execute este arquivo por partes no PowerShell (linha a linha) se preferir.

# 1) Verificar ferramentas basicas
python --version
pip --version
docker --version

# 2) Instalar LocalStack CLI e AWS CLI local wrappers
pip install localstack awscli-local awscli

# 3) Iniciar LocalStack (requer Docker Desktop aberto)
# LocalStack CLI 2026.x exige token de autenticacao.
# Defina seu token antes de executar este script, por exemplo:
# $env:LOCALSTACK_AUTH_TOKEN = "ls-xxxxxxxxxxxxxxxx"
if (-not $env:LOCALSTACK_AUTH_TOKEN) {
  throw "Defina LOCALSTACK_AUTH_TOKEN antes de iniciar. Exemplo: `$env:LOCALSTACK_AUTH_TOKEN = 'ls-...'"
}

# Credenciais dummy para chamadas AWS contra LocalStack
$env:AWS_ACCESS_KEY_ID = "test"
$env:AWS_SECRET_ACCESS_KEY = "test"
$env:AWS_DEFAULT_REGION = "us-east-1"

function Invoke-LocalStack {
  param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
  )

  $lsGlobal = Get-Command localstack -ErrorAction SilentlyContinue
  if ($lsGlobal) {
    & localstack @Args
    return
  }

  $candidatos = @(
    "$env:LOCALAPPDATA\Python\pythoncore-3.14-64\Scripts\localstack.exe",
    "$env:LOCALAPPDATA\Programs\Python\Python314\Scripts\localstack.exe",
    "$env:APPDATA\Python\Python314\Scripts\localstack.exe"
  )

  foreach ($c in $candidatos) {
    if (Test-Path $c) {
      Write-Host "Usando LocalStack em: $c"
      & $c @Args
      return
    }
  }

  throw "LocalStack nao encontrado. Reinstale com: pip install localstack"
}

if ((Test-NetConnection -ComputerName localhost -Port 4566 -WarningAction SilentlyContinue).TcpTestSucceeded) {
  Write-Host "LocalStack ja esta em execucao na porta 4566."
} else {
  Invoke-LocalStack start -d
}

# 4) Definir endpoint e regiao
$Endpoint = "http://localhost:4566"
$Region = "us-east-1"

# 5) Resolver AWS CLI com fallback automatico
function Invoke-Aws {
  param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
  )

  $awsGlobal = Get-Command aws -ErrorAction SilentlyContinue
  if ($awsGlobal) {
    & aws @Args
    return
  }

  $candidatos = @(
    "$env:LOCALAPPDATA\Python\pythoncore-3.14-64\Scripts\aws.exe",
    "$env:LOCALAPPDATA\Programs\Python\Python314\Scripts\aws.exe",
    "$env:APPDATA\Python\Python314\Scripts\aws.exe"
  )

  foreach ($c in $candidatos) {
    if (Test-Path $c) {
      Write-Host "Usando AWS CLI em: $c"
      & $c @Args
      return
    }
  }

  Write-Host "aws.exe nao encontrado. Usando fallback: python -m awscli"
  python -m awscli @Args
}

# 6) Testar AWS CLI
Invoke-Aws --version

# 7) Criar tabela controle_users
Invoke-Aws dynamodb create-table `
  --table-name controle_users `
  --attribute-definitions "AttributeName=login,AttributeType=S" `
  --key-schema "AttributeName=login,KeyType=HASH" `
  --billing-mode PAY_PER_REQUEST `
  --no-sign-request `
  --endpoint-url $Endpoint `
  --region $Region

# 8) Criar tabela controle_sessions
Invoke-Aws dynamodb create-table `
  --table-name controle_sessions `
  --attribute-definitions "AttributeName=token,AttributeType=S" `
  --key-schema "AttributeName=token,KeyType=HASH" `
  --billing-mode PAY_PER_REQUEST `
  --no-sign-request `
  --endpoint-url $Endpoint `
  --region $Region

# 9) Criar tabela controle_login_attempts
Invoke-Aws dynamodb create-table `
  --table-name controle_login_attempts `
  --attribute-definitions "AttributeName=login,AttributeType=S" `
  --key-schema "AttributeName=login,KeyType=HASH" `
  --billing-mode PAY_PER_REQUEST `
  --no-sign-request `
  --endpoint-url $Endpoint `
  --region $Region

# 10) Listar tabelas para confirmar
Invoke-Aws dynamodb list-tables --no-sign-request --endpoint-url $Endpoint --region $Region

# 11) Rodar servidor do projeto
Set-Location $PSScriptRoot
node server.js

# 12) Teste rapido da API (em outro terminal)
# curl http://localhost:3000/api/bootstrap
