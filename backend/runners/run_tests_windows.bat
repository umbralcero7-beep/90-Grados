@echo off
setlocal enabledelayedexpansion

echo ==========================================================
echo   SISTEMA POS 90 GRADOS - RUNNER DE PRUEBAS WINDOWS
echo ==========================================================

echo [*] Ejecutando pruebas unitarias de negocio, seguridad y SQLite...
python -m unittest discover backend/tests
if %errorlevel% neq 0 (
    echo [ERROR] Las pruebas unitarias fallaron.
    exit /b %errorlevel%
)
echo [OK] Pruebas unitarias aprobadas.

echo.
echo Para ejecutar la validacion de PostgreSQL en la base de ensayo,
echo use PowerShell seguro: .\backend\runners\run_tests_windows.ps1 -IncluirPostgres
echo.
pause
