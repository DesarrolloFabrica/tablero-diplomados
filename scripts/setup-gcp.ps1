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
#   2. Da a la cuenta por defecto de Cloud Run acceso de lectura a ese secreto.
# ─────────────────────────────────────────────────────────────────────────────

param(
    [string] $Project    = "it-fab-contenido-edu-4",
    [string] $SecretName = "diplomados-db-password",
    [string] $EnvFile    = (Join-Path $PSScriptRoot "..\.env")
)

$ErrorActionPreference = "Stop"

Write-Host "1/2 Secreto $SecretName"
$line = Get-Content $EnvFile | Where-Object { $_ -match '^\s*DB_PASSWORD\s*=' } | Select-Object -First 1
if (-not $line) { throw "No se encontró DB_PASSWORD en $EnvFile" }
$password = ($line -replace '^\s*DB_PASSWORD\s*=\s*', '').Trim().Trim("'").Trim('"')
$tmp = New-TemporaryFile
try {
    [System.IO.File]::WriteAllText($tmp.FullName, $password)
    $exists = gcloud secrets list --project $Project --filter "name~$SecretName" --format "value(name)"
    if ($exists) {
        gcloud secrets versions add $SecretName --project $Project --data-file $tmp.FullName
    } else {
        gcloud secrets create $SecretName --project $Project --replication-policy automatic --data-file $tmp.FullName
    }
} finally {
    Remove-Item $tmp.FullName -Force
}

Write-Host "2/2 Acceso de Cloud Run al secreto"
$number = gcloud projects describe $Project --format "value(projectNumber)"
gcloud secrets add-iam-policy-binding $SecretName --project $Project `
    --member "serviceAccount:$number-compute@developer.gserviceaccount.com" `
    --role roles/secretmanager.secretAccessor --format none

Write-Host "`nListo. Despliega con:`n  gcloud builds submit --config cloudbuild.yaml --project $Project"
