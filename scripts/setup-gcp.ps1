# ─────────────────────────────────────────────────────────────────────────────
# Configuración única en GCP para el Tablero Diplomados (idempotente).
#
#   .\scripts\setup-gcp.ps1
#
# Igual que los demás backends del proyecto que usan core-database:
#   - Cloud Run corre con la cuenta por defecto (compute) y sale por el conector
#     VPC cr-connector (IP fija ya autorizada en core-database).
#   - La contraseña de la base vive en Secret Manager (diplomados-db-password).
#
# Qué hace:
#   1. Crea/actualiza el secreto con DB_PASSWORD (leído del .env, nunca se imprime).
#   2. Crea el secreto de la cookie de sesión si todavía no existe.
#   3. Da a la cuenta por defecto de Cloud Run acceso de lectura a ambos secretos.
# ─────────────────────────────────────────────────────────────────────────────

param(
    [string] $Project           = "it-fab-contenido-edu-4",
    [string] $SecretName        = "diplomados-db-password",
    [string] $SessionSecretName = "diplomados-session-secret",
    [string] $EnvFile           = (Join-Path $PSScriptRoot "..\.env")
)

$ErrorActionPreference = "Stop"

function Set-SecretFile([string] $Name, [string] $Path) {
    $exists = gcloud secrets list --project $Project --filter "name~$Name" --format "value(name)"
    if ($exists) {
        gcloud secrets versions add $Name --project $Project --data-file $Path
    } else {
        gcloud secrets create $Name --project $Project --replication-policy automatic --data-file $Path
    }
}

function Grant-Secret([string] $Name, [string] $Member) {
    gcloud secrets add-iam-policy-binding $Name --project $Project `
        --member $Member `
        --role roles/secretmanager.secretAccessor --format none
}

Write-Host "1/3 Secreto $SecretName"
$line = Get-Content $EnvFile | Where-Object { $_ -match '^\s*DB_PASSWORD\s*=' } | Select-Object -First 1
if (-not $line) { throw "No se encontró DB_PASSWORD en $EnvFile" }
$password = ($line -replace '^\s*DB_PASSWORD\s*=\s*', '').Trim().Trim("'").Trim('"')
$tmp = New-TemporaryFile
try {
    [System.IO.File]::WriteAllText($tmp.FullName, $password)
    Set-SecretFile $SecretName $tmp.FullName
} finally {
    Remove-Item $tmp.FullName -Force
}

Write-Host "2/3 Secreto $SessionSecretName"
$sessionExists = gcloud secrets list --project $Project --filter "name~$SessionSecretName" --format "value(name)"
if (-not $sessionExists) {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $sessionTmp = New-TemporaryFile
    try {
        [System.IO.File]::WriteAllText($sessionTmp.FullName, [Convert]::ToBase64String($bytes))
        Set-SecretFile $SessionSecretName $sessionTmp.FullName
    } finally {
        Remove-Item $sessionTmp.FullName -Force
    }
} else {
    Write-Host "   ya existe; no se rota"
}

Write-Host "3/3 Acceso de Cloud Run a los secretos"
$number = gcloud projects describe $Project --format "value(projectNumber)"
$member = "serviceAccount:$number-compute@developer.gserviceaccount.com"
Grant-Secret $SecretName $member
Grant-Secret $SessionSecretName $member

Write-Host "`nListo. Despliega con:`n  gcloud builds submit --config cloudbuild.yaml --project $Project"
