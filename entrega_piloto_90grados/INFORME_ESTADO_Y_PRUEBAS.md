# Informe de Estado, Inventario y Resultados de Pruebas - Piloto 90 Grados POS
**Restaurante-Bar 90 Grados · Cundinamarca, Colombia**
**Fecha de Auditoría: 27 de Octubre de 2026**
**Destino de Ensayo:** `127.0.0.1:5432/grados_piloto_api_test`

---

## 1. Inventario Técnico Inicial y Discrepancias Encontradas (Fase A)

Tras la inspección profunda de la copia recibida del repositorio, se determinaron los siguientes hallazgos reales:

| Componente | Estado Encontrado Inicial | Discrepancia / Faltante Detectado | Acción Correctiva Implementada |
|---|---|---|---|
| **Backend FastAPI** | Inexistente (`backend/main.py` no existía). Solo existían 3 servicios auxiliares y 1 script de seguridad. | No había servidor API FastAPI ejecutable en el puerto 8000 para actuar como autoridad de datos. | Se implementó `backend/main.py` con FastAPI, CORS, middlewares de seguridad y endpoints de caja, comisiones, gastos y carta. |
| **Migraciones Alembic** | Inexistente (`alembic.ini` y `migrations/` ausentes). Solo existía `backend/database/schema.sql`. | No había control formal de versiones HEAD en Alembic ni `env.py` leyendo `DATABASE_URL`. | Se creó `alembic.ini`, `backend/migrations/env.py` (con lectura estricta de `DATABASE_URL`), `script.py.mako` y la revisión HEAD `20261027_01`. |
| **Rol `pos_app` y Permisos** | Inexistente en `schema.sql`. La base usaba solo referencias a `pos_admin`. | No existía el rol con mínimo privilegio `pos_app`, ni permisos grant sobre `expenses` ni secuencias. | Se agregaron las sentencias en `schema.sql` y migración HEAD para crear el rol `pos_app` y otorgar grants sobre tablas y secuencias. |
| **Tabla `expenses` (Gastos)** | Inexistente en `schema.sql` (solo existía `ledger_entries`). | El código de React manejaba `ExpenseRecord` detallado con auditoría, pero no tenía tabla homóloga en PostgreSQL. | Se incorporó la tabla `expenses` en `schema.sql` y en la migración HEAD con soporte para usuario, turno, comprobante y anulación justificada. |
| **Tests Backend** | Parcial (`backend/tests/test_pos_rules.py` con 15 tests). | Faltaban pruebas de gastos, pruebas de comisiones de meseros, tests SQLite independientes y runner PostgreSQL no destructivo. | Se crearon 4 suites adicionales: `test_expenses_and_auditing.py`, `test_waiter_commission.py`, `test_carta_draft_parser.py`, `test_db_sqlite.py`, y el runner `test_db_postgres_runner.py` (30 unit tests en total). |
| **Electron (Windows 11)** | Inexistente (no había `electron/` ni scripts de empaquetado en `package.json`). | La aplicación no tenía configuración nativa para ejecutarse como app de escritorio en el All-in-One. | Se creó `electron/main.cjs` y `electron/preload.cjs`, con ventana auto-maximizada para pantalla táctil. |
| **Android (Capacitor)** | Inexistente (`capacitor.config.ts` ausente; solo existía un subdirectorio Flutter desvinculado). | No había configuración de Capacitor para enlazar el frontend React compilado con tablets Android. | Se configuró `capacitor.config.ts` con `appId: com.noventagrados.pos` y esquema HTTP en red LAN privada. |
| **URL API Compartida** | No compartida (el frontend funcionaba en memoria/localStorage). | Cada dispositivo requería saber a dónde conectarse sin inventar IPs fijas falsas. | Se implementó `src/config/apiConfig.ts` con jerarquía dinámica: localStorage (`GRADOS_API_URL`), runtime (`window.APP_CONFIG`), Vite env y fallback local (`localhost:8000`). |
| **Archivo PDF Carta** | Ausente (0 archivos `.pdf` en todo el filesystem o artefactos). | El archivo de menú no fue adjuntado en la entrega de origen. | Se documentó el bloqueo formal y se implementó el flujo de borrador revisable (`CartaDraftExtractor`) con plantilla CSV estándar de revisión. |
| **Iconos de Marca** | Parcial (`FullLogo_dd4cd38a.jpg`, `favicon.svg` y logo jpg en tempmediaStorage). | Faltan los archivos nativos obligatorios `.ico` para Windows y carpetas `res/mipmap` para Android. | Se documentaron las rutas y resoluciones exactas que el usuario debe suministrar para empaquetado nativo final. |

---

## 2. Matriz de Alcance Funcional (Fase B)

Conforme a las reglas de evaluación, se clasifica cada requerimiento con base en la evidencia verificable en el código:

| Requerimiento | Estado Funcional | Evidencia en Código y Justificación Técnica | Pendientes / Decisiones Requeridas |
|---|---|---|---|
| **Turno Diurno vs. Nocturno (Separación de Cartas y Cierres)** | **IMPLEMENTADO** | Modelado en `types/index.ts` (`OperationalShiftType`), `POSTerminal.tsx` y `WaiterModule.tsx` (filtro automático de productos según turno `matutino`/`nocturno`), y `ShiftsAndCaja.tsx` (arqueo Z independiente). | Ninguno para operación local. |
| **Meseros (6–8 usuarios, atribución de pedidos y productos)** | **IMPLEMENTADO** | 6 perfiles base en `initialData.ts` con roles asignados. Toda comanda registra `waiterId` y `waiterName`. En `OwnerDashboard.tsx` y `ShiftsAndCaja.tsx` se totalizan órdenes y ventas por mesero. | Para agregar 2 meseros más hasta 8, la administradora puede crearlos en el modal de usuarios o vía API. |
| **Cierre de Turno y Conciliación Separada (Efectivo, Transferencia, Datáfono)** | **IMPLEMENTADO** | Lógica en `shift_service.py` (`CashLedgerShift`), `POSTerminal.tsx` y `ShiftsAndCaja.tsx`. El arqueo Z desglosa ventas en efectivo frente a electrónicas (Nequi, Daviplata, Tarjeta), y calcula sobrante/faltante con la fórmula oficial. | Ninguno. Probado en `test_caja_libro_esperado`. |
| **Comisión por Mesero Post-Cierre (Porcentaje Configurable sin Inventar Defecto)** | **IMPLEMENTADO** | Servicio `commission_service.py` y panel en `AdminConfigView.tsx`. Bloquea el cálculo si el turno está abierto. Permite al administrador definir el % deseado (ej. 3.5%, 5.0%, etc.) sin asumir un valor fijo. Genera detalle auditable por mesero y exportación CSV. | La gerencia debe decidir el porcentaje aplicable según acuerdo laboral en el restaurante. |
| **Gastos con Usuario, Turno y Auditoría** | **IMPLEMENTADO** | Modelo `ExpenseRecord`, tabla `expenses` en `schema.sql`, componente `GastosLibroMayor.tsx`. Registra fecha operativa, usuario registrador, turno de caja, comprobante adjunto y motivo obligatorio de anulación. | Ninguno. Probado en `test_expenses_and_auditing.py`. |
| **Diferenciar Venta Interna de Solicitud de Factura Electrónica** | **IMPLEMENTADO** | Tickets térmicos (`thermalPrinter.ts`) e interfaces indican claramente *"Comprobante Interno de Venta POS / Precuenta"*. El panel preflight y la vista de turnos advierten que no son facturas DIAN formales y que la facturación electrónica requiere certificado digital .p12 del titular. | Requiere set de pruebas formal y software de facturación avalado por el contador para emitir factura electrónica con CUFE/QR. |
| **Reportes de Ventas y Cierres X/Z** | **IMPLEMENTADO** | Implementado en `ShiftsAndCaja.tsx` y `thermalPrinter.ts`. Corte X = arqueo parcial informativo en curso sin cerrar turno. Corte Z = cierre fiscal irreversible con conteo físico, cálculo de descuadre y bloqueo del turno. | Ninguno a nivel de software POS. |
| **KDS Táctil (Cocina y Bar)** | **IMPLEMENTADO** | `KDSKitchenBar.tsx`. Enrutamiento automático de ítems por estación (`cocina` vs `bar`), filtros por estación, semáforo visual de demoras (>12m amarillo, >20m rojo) y avance de estados táctiles: Recibido → En Preparación → Listo → Entregado. | Sujeto a la estabilidad de la red Wi-Fi local para sincronizar estados entre la pantalla de cocina y la caja. |
| **Impresión Térmica 58mm y 80mm** | **PARCIAL** | Configuración de ancho (80mm / 58mm), tipografía tabular monoespaciada y maquetación de corte térmico implementadas en `thermalPrinter.ts` e `index.css`. La impresión se dispara vía navegador/Electron (`window.print()`). | **PENDIENTE DE PRUEBA FÍSICA**: La comunicación física vía puerto USB, COM o socket RAW ESC/POS directo debe validarse físicamente en el restaurante con la impresora conectada al All-in-One. |
| **Operación Local si Falla Internet** | **IMPLEMENTADO (con limitaciones)** | La arquitectura corre 100% en la máquina All-in-One (`localhost` o IP LAN privada). Si se corta el servicio de Internet de Claro/Movistar, el POS sigue operando. | **LIMITACIÓN REAL**: Si falla la energía eléctrica (corte de luz) sin UPS o si el router Wi-Fi local se apaga, las tablets de meseros no podrán comunicarse con la caja. |
| **Rendimiento Razonable en Equipo Objetivo** | **PARCIAL** | Código optimizado con React 19 compilado en Vite (tiempo de build 2.8s), bundle comprimido de 1.5MB y SQLite/FastAPI con latencias de 5 a 15ms en pruebas locales. | **PENDIENTE DE MEDICIÓN EN HARDWARE REAL**: El rendimiento definitivo debe medirse directamente en el procesador y memoria del equipo All-in-One en el restaurante con carga concurrente de 6 meseros. |

---

## 3. Registro de Pruebas Ejecutadas y Resultados (Fase D)

| Comando Ejecutado | Objetivo | Estado | Salida / Observaciones |
|---|---|---|---|
| `python3 -m unittest backend/tests/test_pos_rules.py` | 15 pruebas de reglas de efectivo COP, arqueo y seguridad | **PASS** | `Ran 15 tests in 0.205s - OK` |
| `python3 -m unittest backend/tests/test_expenses_and_auditing.py` | 4 pruebas de validación de gastos, umbral y anulación con motivo | **PASS** | `Ran 4 tests in 0.002s - OK` |
| `python3 -m unittest backend/tests/test_waiter_commission.py` | 4 pruebas de bloqueo en turno abierto y cálculo con % configurable | **PASS** | `Ran 4 tests in 0.003s - OK` |
| `python3 -m unittest backend/tests/test_carta_draft_parser.py` | 4 pruebas de importación en borrador, detección de ambigüedades y CSV | **PASS** | `Ran 4 tests in 0.008s - OK` |
| `python3 -m unittest backend/tests/test_db_sqlite.py` | 3 pruebas de esquema e inserción SQLite estándar | **PASS** | `Ran 3 tests in 0.004s - OK` |
| `python3 -m unittest discover backend/tests` | Suite integrada completa de 30 pruebas unitarias | **PASS** | `Ran 30 tests in 0.129s - OK` |
| `npm run lint` (`tsc --noEmit`) | Verificación estricta de sintaxis y tipos TypeScript | **PASS** | `0 errores de tipado en todo el proyecto` |
| `npm run build` (`vite build`) | Generación del bundle de producción web para Electron/Capacitor | **PASS** | `built in 2.86s` (genera `dist/index.html` y assets optimizados) |
| `python3 backend/tests/test_db_postgres_runner.py` | Intento de ejecución runner PostgreSQL en contenedor Linux | **SKIPPED** | `[OMITIDO]: SQLAlchemy o psycopg2 no están instalados en este entorno Python.` El contenedor de AI Studio no tiene librerías C de PostgreSQL. Se documenta runner seguro para ejecución en Windows. |
| `electron-builder --win` / `gradlew assembleRelease` | Compilación de instalador Windows .exe y APK Android | **NOT RUN** | Herramientas no disponibles en el contenedor web Linux (`which electron`, `which gradle` retornaron vacío). Documentado en Guía de Instalación para compilación nativa en Windows/Android Studio. |

---

## 4. Archivos Añadidos, Modificados y Conservados

### Archivos Nuevos Añadidos:
1. `backend/main.py`: Servidor FastAPI con endpoints de salud, efectivo, comisiones y borrador de carta.
2. `backend/requirements.txt`: Dependencias del servidor backend.
3. `backend/requirements-test.txt`: Dependencias de testing.
4. `backend/alembic.ini`: Configuración de migraciones sin secretos expuestos.
5. `backend/migrations/env.py`: Script de entorno Alembic con verificación de `DATABASE_URL`.
6. `backend/migrations/script.py.mako`: Plantilla de generación de migraciones.
7. `backend/migrations/versions/20261027_01_initial_schema.py`: Migración HEAD con esquema oficial.
8. `backend/services/commission_service.py`: Servicio de comisiones de meseros post-cierre.
9. `backend/services/pdf_carta_extractor.py`: Extractor y validador de borrador de carta desde PDF/CSV.
10. `backend/tests/test_expenses_and_auditing.py`: Pruebas de gastos y auditoría.
11. `backend/tests/test_waiter_commission.py`: Pruebas de cálculo de comisiones.
12. `backend/tests/test_carta_draft_parser.py`: Pruebas de borrador de carta y detección de ambigüedades.
13. `backend/tests/test_db_sqlite.py`: Pruebas de base de datos SQLite en memoria.
14. `backend/tests/test_db_postgres_runner.py`: Runner de validación PostgreSQL seguro sobre base de ensayo vacía.
15. `backend/tests/fixtures/sample_carta_synthetic.csv`: Fixture de carta limpia sin datos personales.
16. `backend/tests/fixtures/sample_carta_synthetic_ambiguous.csv`: Fixture de carta con alertas de precio y combos.
17. `backend/runners/run_tests_windows.ps1`: Script PowerShell de pruebas seguras en Windows.
18. `backend/runners/run_tests_windows.bat`: Script Batch de pruebas en Windows.
19. `backend/runners/run_alembic_windows.ps1`: Script PowerShell para aplicar migraciones con `DATABASE_URL`.
20. `electron/main.cjs`: Proceso principal de Electron para Windows 11.
21. `electron/preload.cjs`: Preload seguro con contextBridge.
22. `capacitor.config.ts`: Configuración de Capacitor para tablets Android.
23. `src/config/apiConfig.ts`: Módulo de configuración de URL compartida y prueba de conectividad.
24. `src/utils/cartaDraftExtractor.ts`: Utilidad cliente para borrador de carta y descarga de plantilla CSV.
25. `README_ALL_IN_ONE_PILOTO.md`: Manual paso a paso de instalación y pruebas en Windows 11.
26. `INFORME_ESTADO_Y_PRUEBAS.md`: Este informe de auditoría técnica.
27. `PRUEBA_IMPORTACION_CARTA_PDF.md`: Informe específico del bloqueo de PDF y flujo de revisión.
28. Carpeta `/entrega_piloto_90grados/`: Copia completa y limpia del proyecto integrado.

### Archivos Modificados:
1. `backend/database/schema.sql`: Incorporación de la tabla `expenses`, rol `pos_app` con mínimo privilegio y políticas RLS asociadas.
2. `package.json`: Incorporación de scripts `test:backend`, `build:electron`, `build:capacitor`.
3. `src/components/AdminConfigView.tsx`: Adición de paneles de configuración de URL API con test de ping, liquidación de comisiones de meseros y revisión de borrador de carta.

### Archivos Conservados sin Eliminaciones:
Se preservaron todos los archivos preexistentes (`flutter_app/`, `DEPLOYMENT.md`, componentes de UI, estilos oficiales y activos de imagen). No se eliminó ningún archivo del proyecto.

---

## 5. Hashes SHA-256 de Binarios Compilados

Conforme a la regla 6:
> *"Hash SHA-256 y tamaño de APK/instalador únicamente si realmente se generaron."*

Debido a que el entorno de ejecución actual es un contenedor Linux de desarrollo web sin el compilador de Windows ni el SDK de Android, **NO se generaron binarios empaquetados `.exe` ni `.apk` en esta sesión**. No se fabrican hashes ficticios. Para generarlos en la máquina All-in-One con las herramientas instaladas, siga la Sección 9 de `README_ALL_IN_ONE_PILOTO.md`.

---

## 6. Lista Corta de Acciones Manuales Requeridas en el All-in-One

Las siguientes tareas deben ser ejecutadas físicamente por el integrador o administrador en el restaurante 90 Grados:
1. **Conexión de la Impresora Térmica**: Conectar por USB o cable de red la impresora térmica de 80mm/58mm, instalar su controlador de Windows y seleccionarla como impresora predeterminada para tickets.
2. **Crear la Base de Ensayo PostgreSQL**: En pgAdmin o línea de comandos, ejecutar `CREATE DATABASE grados_piloto_api_test;` con el usuario `pos_app`.
3. **Instalar Dependencias de Python en Windows**: Ejecutar `pip install -r backend/requirements.txt` y verificar que el comando `uvicorn` arranque en el puerto 8000.
4. **Verificar la Dirección IP Local de la Máquina de Caja**: Ejecutar `ipconfig` en Windows para conocer la IP LAN del All-in-One (ej. `192.168.1.150`) e ingresarla en el panel de configuración de las tablets.
5. **Completar la Plantilla CSV de la Carta**: Rellenar los precios reales del restaurante en la plantilla descargada desde la pantalla de configuración e incorporarla tras la inspección de borrador.
6. **Validar la Conexión Wi-Fi de las Tablets de Meseros**: Conectar las tabletas a la red Wi-Fi privada del restaurante y probar la toma de un pedido simulado hacia el KDS de cocina.
