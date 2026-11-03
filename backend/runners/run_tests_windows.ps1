# ==============================================================================
# 90 Grados POS - Runner Seguro de Pruebas Windows PowerShell
# Cundinamarca, Colombia
# SEGURIDAD: Credenciales interactivas ocultas. Destino limitado a 127.0.0.1:5432/grados_piloto_api_test
# No imprime secretos ni URLs con contraseñas.
# ==============================================================================

param(
    [switch]$SoloUnitarios = $false,
    [switch]$IncluirPostgres = $false
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Yellow
Write-Host "  SISTEMA POS 90 GRADOS - SUITE DE PRUEBAS AUTOMATIZADAS  " -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Yellow

# 1. Pruebas Unitarias y SQLite (Sin dependencias externas obligatorias)
Write-Host "`n[*] Paso 1: Ejecutando pruebas unitarias de negocio, seguridad y SQLite..." -ForegroundColor Cyan
python -m unittest discover backend/tests

if ($LASTEXITCODE -ne 0) {
    Write-Error "[FALLO]: Una o más pruebas unitarias fallaron. Deteniendo ejecución."
    exit $LASTEXITCODE
}
Write-Host "[OK] Pruebas unitarias y de SQLite aprobadas con éxito." -ForegroundColor Green

if ($SoloUnitarios -or (-not $IncluirPostgres)) {
    Write-Host "`n[INFO] Ejecución completada en modo unitario seguro." -ForegroundColor Gray
    Write-Host "Para ejecutar la validación PostgreSQL contra grados_piloto_api_test, use: -IncluirPostgres" -ForegroundColor Gray
    exit 0
}

# 2. Paso PostgreSQL con solicitud segura de credenciales en memoria
Write-Host "`n[*] Paso 2: Validación PostgreSQL sobre base de ensayo..." -ForegroundColor Cyan
Write-Host "Destino estricto de seguridad: 127.0.0.1:5432/grados_piloto_api_test" -ForegroundColor Yellow

$dbUser = Read-Host "Usuario PostgreSQL [pos_app]"
if (-not $dbUser) { $dbUser = "pos_app" }

# Solicitud de contraseña oculta en memoria (SecureString)
$dbPassSecure = Read-Host "Contraseña PostgreSQL (oculta)" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPassSecure)
$PlainPass = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)

# Inyectar temporalmente en variable de entorno solo en memoria de este proceso
$env:PILOT_TEST_POSTGRES_URL = "postgresql://${dbUser}:${PlainPass}@127.0.0.1:5432/grados_piloto_api_test"

try {
    python backend/tests/test_db_postgres_runner.py
}
finally {
    # Limpieza inmediata de credenciales en memoria
    $env:PILOT_TEST_POSTGRES_URL = $null
    $PlainPass = $null
}

if ($LASTEXITCODE -ne 0) {
    Write-Error "[FALLO]: La validación PostgreSQL no superó los controles de seguridad o esquema."
    exit $LASTEXITCODE
}

Write-Host "`n[EXITO COMPLETO]: Todas las pruebas del piloto pasaron satisfactoriamente." -ForegroundColor Green
