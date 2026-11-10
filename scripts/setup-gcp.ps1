# ─────────────────────────────────────────────────────────────────────────────
# Configuración única en GCP para el Tablero Diplomados (idempotente: se puede
# volver a ejecutar). Requiere gcloud autenticado con permisos de IAM en ambos
# proyectos.
#
#   .\scripts\setup-gcp.ps1
#
# Qué hace:
#   1. Crea la cuenta de servicio del backend en el proyecto de Cloud Run.
#   2. Crea/actualiza el secreto con DB_PASSWORD (leído del .env, nunca se imprime).
#   3. Da a la cuenta acceso al secreto y rol Cloud SQL Client en el proyecto de la DB.
#   4. Permite a Cloud Build desplegar Cloud Run usando esa cuenta.
# ─────────────────────────────────────────────────────────────────────────────

param(
    [string] $Project    = "it-fab-contenido-edu-4",   # donde corren los servicios Cloud Run
    [string] $DbProject  = "it-fab-contenido-edu-6",   # donde vive core-database
    [string] $SaName     = "diplomados-backend",
    [string] $SecretName = "diplomados-db-password",
    [string] $EnvFile    = (Join-Path $PSScriptRoot "..\.env")
)

$ErrorActionPreference = "Stop"
$sa = "$SaName@$Project.iam.gserviceaccount.com"

Write-Host "1/4 Cuenta de servicio $sa"
$exists = gcloud iam service-accounts list --project $Project --filter "email:$sa" --format "value(email)"
if (-not $exists) {
    gcloud iam service-accounts create $SaName --project $Project --display-name "Tablero Diplomados - backend"
}

Write-Host "2/4 Secreto $SecretName"
$line = Get-Content $EnvFile | Where-Object { $_ -match '^\s*DB_PASSWORD\s*=' } | Select-Object -First 1
if (-not $line) { throw "No se encontró DB_PASSWORD en $EnvFile" }
$password = ($line -replace '^\s*DB_PASSWORD\s*=\s*', '').Trim().Trim("'").Trim('"')
$tmp = New-TemporaryFile
try {
    [System.IO.File]::WriteAllText($tmp.FullName, $password)
    $secretExists = gcloud secrets list --project $Project --filter "name:$SecretName" --format "value(name)"
    if ($secretExists) {
        gcloud secrets versions add $SecretName --project $Project --data-file $tmp.FullName
    } else {
        gcloud secrets create $SecretName --project $Project --replication-policy automatic --data-file $tmp.FullName
    }
} finally {
    Remove-Item $tmp.FullName -Force
}

Write-Host "3/4 Permisos de la cuenta de servicio"
gcloud secrets add-iam-policy-binding $SecretName --project $Project `
    --member "serviceAccount:$sa" --role roles/secretmanager.secretAccessor --format none
gcloud projects add-iam-policy-binding $DbProject `
    --member "serviceAccount:$sa" --role roles/cloudsql.client --condition None --format none

Write-Host "4/4 Cloud Build puede desplegar con esa cuenta"
$number = gcloud projects describe $Project --format "value(projectNumber)"
$buildSa = "$number-compute@developer.gserviceaccount.com"
gcloud iam service-accounts add-iam-policy-binding $sa --project $Project `
    --member "serviceAccount:$buildSa" --role roles/iam.serviceAccountUser --format none

Write-Host "`nListo. Ahora despliega con:`n  gcloud builds submit --config cloudbuild.yaml --project $Project"
