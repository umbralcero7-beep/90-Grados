# ==============================================================================
# 90 Grados POS - Runner Seguro de Migraciones Alembic Windows PowerShell
# Cundinamarca, Colombia
# Regla: Establece DATABASE_URL en memoria antes de cargar Alembic.
# Destino de ensayo: 127.0.0.1:5432/grados_piloto_api_test
# ==============================================================================

param(
    [string]$Comando = "upgrade head"
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Yellow
Write-Host "  SISTEMA POS 90 GRADOS - MIGRACIONES SEGURAS CON ALEMBIC " -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Yellow

Write-Host "Destino de ensayo autorizado: 127.0.0.1:5432/grados_piloto_api_test" -ForegroundColor Cyan

$dbUser = Read-Host "Usuario PostgreSQL [pos_app]"
if (-not $dbUser) { $dbUser = "pos_app" }

$dbPassSecure = Read-Host "Contraseña PostgreSQL (oculta)" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPassSecure)
$PlainPass = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)

# Inyectar DATABASE_URL estrictamente en memoria del proceso
$env:DATABASE_URL = "postgresql://${dbUser}:${PlainPass}@127.0.0.1:5432/grados_piloto_api_test"

try {
    cd backend
    Write-Host "[*] Ejecutando: alembic $Comando" -ForegroundColor Cyan
    alembic $Comando
    cd ..
}
finally {
    $env:DATABASE_URL = $null
    $PlainPass = $null
}

if ($LASTEXITCODE -ne 0) {
    Write-Error "[ERROR] Falló la ejecución de Alembic."
    exit $LASTEXITCODE
}

Write-Host "[OK] Migración completada exitosamente." -ForegroundColor Green
