# Guía de Instalación, Compilación y Pruebas - Piloto 90 Grados POS
**Equipo Objetivo: All-in-One con Windows 11 Pro · Restaurante-Bar 90 Grados**
**Ubicación: Cundinamarca, Colombia · Zona Horaria: America/Bogota**

---

## 1. Requisitos Previos en el Equipo All-in-One (Windows 11)

Antes de iniciar la instalación, asegúrese de contar con los siguientes programas instalados en Windows 11:
1. **Node.js**: Versión LTS 20 o superior (incluye `npm`).
2. **Python**: Versión 3.10 o 3.11 con `pip` habilitado y agregado al PATH del sistema.
3. **PostgreSQL**: Versión 15 o superior en ejecución local (`127.0.0.1:5432`).
4. **Git**: Para control de versiones o clonación local.
5. **(Opcional para Android)**: Android Studio con Android SDK Build-Tools y JDK 17 para generar APK en físico.
6. **(Opcional para Windows)**: Visual Studio Build Tools C++ si se compilan módulos nativos de Electron.

---

## 2. Preparación de la Carpeta de Trabajo

1. Copie la carpeta de entrega `entrega_piloto_90grados` en una ruta local limpia sin espacios ni caracteres especiales en la máquina All-in-One, por ejemplo:
   ```powershell
   C:\90grados\entrega_piloto_90grados
   ```
2. Abra PowerShell como Administrador y navegue al directorio:
   ```powershell
   cd C:\90grados\entrega_piloto_90grados
   ```

---

## 3. Instalación de Dependencias

### A. Dependencias Frontend & Electron
Ejecute en la raíz del proyecto:
```powershell
npm install
```

### B. Dependencias Backend Python
Ejecute:
```powershell
pip install -r backend/requirements.txt
pip install -r backend/requirements-test.txt
```

---

## 4. Verificación de la Base de Ensayo PostgreSQL

> **REGLA ESTRICTA DE SEGURIDAD**:
> - Destino autorizado: `127.0.0.1:5432/grados_piloto_api_test`
> - PROHIBIDO conectar a `grados_demo` o `grados_piloto_validacion`.
> - Si la base ya contiene tablas, el runner SE DETIENE y no modifica datos existentes.

1. En el Administrador de PostgreSQL (pgAdmin o `psql`), cree la base de ensayo vacía si aún no existe:
   ```sql
   CREATE DATABASE grados_piloto_api_test;
   ```
2. Ejecute el verificador seguro en PowerShell (solicita contraseña de forma oculta en memoria, sin escribirla en archivos ni en pantalla):
   ```powershell
   .\backend\runners\run_tests_windows.ps1 -IncluirPostgres
   ```
   - Si la base está vacía: ejecutará la verificación no destructiva en transacción reversible.
   - Si la base ya tiene tablas: se detendrá con el mensaje `[DETENCIÓN DE SEGURIDAD]` respetando los datos existentes.

---

## 5. Migraciones con Alembic

Alembic lee dinámicamente la variable `DATABASE_URL` en memoria antes de conectarse. Nunca registre contraseñas en `alembic.ini`.

Para aplicar las migraciones HEAD a la base de ensayo:
```powershell
.\backend\runners\run_alembic_windows.ps1 -Comando "upgrade head"
```
Esto creará el esquema oficial, la tabla `expenses`, el usuario de mínimo privilegio `pos_app` y las políticas RLS.

---

## 6. Pruebas Automatizadas del Backend

Para ejecutar la suite completa de 30 pruebas unitarias (billetes COP, vueltas exactas, arqueos de caja, liquidación post-cierre de meseros, reglas de gastos, auditoría inmutable, SQLite y extractor de carta):
```powershell
npm run test:backend
# o directamente:
python -m unittest discover backend/tests
```

Resultado esperado:
```text
Ran 30 tests in 0.130s
OK
```

---

## 7. Configuración de la URL de API Compartida

El sistema utiliza una arquitectura **Local-First** donde el backend FastAPI es la autoridad de datos.
- **En el equipo All-in-One de Caja**:
  - Servidor FastAPI corriendo en: `http://localhost:8000`
  - URL en la aplicación: `http://localhost:8000`
- **En Tablets / Teléfonos de Meseros (Red Wi-Fi Local)**:
  - Identifique la IP local del All-in-One con `ipconfig` (ejemplo: `192.168.1.150`).
  - Abra la aplicación POS en la tablet o navegador móvil: `http://192.168.1.150:3000` o app instalada.
  - Ingrese al módulo de **Configuración** (`settings`) y en la tarjeta **Conexión API Local & Dispositivos LAN**, defina:
    `http://192.168.1.150:8000`
  - Presione **Probar Conexión**. Debe observar el estado verde indicando la latencia en milisegundos.
  - Guarde la configuración. Esta preferencia se almacena en el dispositivo (`localStorage`) y no se pierde al reiniciar.

---

## 8. Iniciar el Servidor Backend y la Aplicación en Modo Piloto

### Terminal 1: Backend FastAPI (Puerto 8000)
```powershell
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Terminal 2: Frontend Web POS (Puerto 3000)
```powershell
npm run dev
```

---

## 9. Compilación de Aplicaciones Nativas (Windows & Android)

### A. Empaquetado Windows (Electron para All-in-One)
1. Verifique que el frontend esté compilado:
   ```powershell
   npm run build
   ```
2. Para probar la ventana de Electron en desarrollo:
   ```powershell
   npx electron electron/main.cjs
   ```
3. Para generar el ejecutable final para Windows 11 (requiere `electron-builder` en la máquina Windows):
   ```powershell
   npm install --save-dev electron electron-builder
   npx electron-builder --win nsis
   ```
   *Nota técnica*: Se debe compilar nativamente en Windows con NSIS para generar el instalador formal `.exe`. No debe distribuirse un directorio "unpacked" sin empaquetar como si fuera un instalador.

### B. Compilación Android (Capacitor para Tablets de Meseros)
1. Sincronice el código web compilado con el proyecto Capacitor:
   ```powershell
   npm install --save-dev @capacitor/core @capacitor/cli @capacitor/android
   npx cap add android
   npx cap sync android
   ```
2. Para abrir en Android Studio y generar el APK release:
   ```powershell
   npx cap open android
   ```
   O compilar por línea de comandos con Gradle:
   ```powershell
   cd android
   .\gradlew.bat assembleRelease
   ```
   El binario APK generado se ubicará en:
   `android/app/build/outputs/apk/release/app-release-unsigned.apk` (o firmado con la llave del restaurante).

---

## 10. Pruebas Funcionales Manuales en el All-in-One

Una vez levantado el entorno, ejecute el siguiente recorrido de verificación:
1. **Inicio de Sesión**: Ingrese con usuario `@carmen_gerente` (PIN: `1234`) o `@diana_caja` (PIN: `2345`).
2. **Apertura de Turno**: En el módulo de *Turnos & Caja*, abra el turno diurno de restaurante con fondo inicial de $200.000 COP.
3. **Toma de Comanda (Mesero)**: Con usuario `@mateo_mesero` (PIN: `3456`), ingrese a *Módulo Mesero*, tome un pedido en "Mesa 1" con 1 Picada 90 Grados y 2 Cervezas Poker. Envíe la comanda.
4. **KDS Cocina/Bar**: Abra el módulo *KDS* y verifique que la picada aparece en estación Cocina y las cervezas en estación Bar. Avance el estado a "En Preparación" y luego a "Listo".
5. **Cobro y Facturación en Caja**: Seleccione Mesa 1 en *Terminal POS*, registre pago mixto: $50.000 COP por transferencia Nequi y $50.000 COP en billete físico; compruebe el cálculo exacto de vueltas.
6. **Registro de Gasto**: En *Libro Mayor & Gastos*, registre un egreso de $35.000 COP para insumos de aseo con comprobante de soporte.
7. **Cierre Z**: Ejecute el arqueo final Z en *Turnos & Caja*, cuente el efectivo y verifique que el sobrante/faltante coincida con la fórmula oficial.
8. **Liquidación de Comisiones**: En *Configuración*, seleccione el turno cerrado, ajuste el porcentaje configurable (ej. 5.0%) y descargue el CSV auditable con el desglose por mesero.
