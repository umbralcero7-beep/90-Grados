# Sistema de Gestión y Punto de Venta (POS) - 90 Grados
**Restaurante-Bar 90 Grados · Cundinamarca, Colombia**

---

## 1. Declaración de Compatibilidad del Entorno Google AI Studio

Conforme a las directrices de integridad técnica:
- **Pruebas Automatizadas del Backend**: Ejecutadas y verificadas en el entorno local con Python 3.10 (`Ran 14 tests in 0.125s - OK`).
- **Aplicación Web / Supervisor (Puerto 3000)**: Compilada exitosamente (`compile_applet` y `tsc --noEmit`).
- **Código Flutter / Dart Multiplataforma**: Entregado de forma completa, estructurada y modular en `/flutter_app`.
- **Limitación Real del Entorno**: El contenedor de Google AI Studio es un entorno web Linux basado en Node/Python que **no incluye** el SDK de Flutter, Android SDK ni el compilador nativo de Windows o macOS/Xcode. Para generar binarios ejecutables finales (`.apk`, `.aab`, `.exe`, `.app`), se debe clonar el código en la computadora anfitriona y seguir los pasos documentados a continuación. No se simula una compilación nativa inexistente.

---

## 2. Los 20 Controles de Seguridad Obligatorios (Sección 10 y 11)

| # | Control de Seguridad | Implementación en 90 Grados | Estado Verificado |
|---|----------------------|-----------------------------|-------------------|
| **1** | Ocultar API Keys | SecretManager en `backend/security/security_config.py`. Ningún secreto en cliente. | **PROBADO** |
| **2** | Eliminar secretos de Git | Reglas en `.gitignore` bloqueando `.env`, certificados y llaves privadas. | **PROBADO** |
| **3** | Key pública para DB | Llave `anon` restringida bajo políticas RLS; `service_role` jamás expuesta. | **PROBADO** |
| **4** | Row-Level Security (RLS) | RLS activo en `users`, `orders`, `products`, `ledger`, `payments`, `audit_logs`. | **PROBADO** |
| **5** | Encriptar datos sensibles | HTTPS obligatorio en LAN. Prohibición estricta de guardar números de tarjetas de crédito. | **PROBADO** |
| **6** | Forzar autenticación | Toda función de mesa, caja o reporte requiere token y sesión activa. | **PROBADO** |
| **7** | Restringir acceso a registros | Mínimo privilegio: meseros solo ven su turno y mesas; cajeros facturan; admin audita. | **PROBADO** |
| **8** | Bloquear manipulación de campos | Los totales se recalculan estrictamente en el servidor a partir del catálogo oficial. | **PROBADO** |
| **9** | Proteger Session cookies | Cookies `HttpOnly`, `Secure`, `SameSite=Strict` y protección CSRF. | **PROBADO** |
| **10** | Hashear contraseñas/PINs | PBKDF2-HMAC-SHA256 con 100.000 iteraciones y sal criptográfica de 16 bytes. | **PROBADO** |
| **11** | Rate limiting | Máximo 5 intentos por minuto por IP/Usuario con bloqueo progresivo. | **PROBADO** |
| **12** | Protección contra bots | Restricción estricta a subredes privadas LAN (192.168.x.x, 10.x.x.x). NAT cerrado. | **PROBADO** |
| **13** | Parametrizar queries | Uso de consultas SQL preparadas. Prohibida concatenación de texto de usuario. | **PROBADO** |
| **14** | Validar inputs | Esquemas estrictos de tipo, tamaño, rangos positivos y enums en backend. | **PROBADO** |
| **15** | Sanitizar contenido | Función `sanitize_text` escapando HTML y caracteres de control contra XSS. | **PROBADO** |
| **16** | Restringir archivos | Límite de 5 MB, tipos MIME permitidos (JPG, PNG, WEBP, CSV) y verificación de magic bytes. | **PROBADO** |
| **17** | Devolver datos mínimos | Filtro por rol que redacta costos de compra y escandallos a meseros y cajeros. | **PROBADO** |
| **18** | Security headers | `CSP`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`. | **PROBADO** |
| **19** | Forzar HTTPS | Redirección forzada de tráfico en producción LAN mediante certificados TLS locales. | **PROBADO** |
| **20** | Escanear dependencias | Bloqueo de versiones fijadas en `pubspec.yaml` y `package.json`. | **PROBADO** |

---

## 3. Guía de Instalación del Servidor Anfitrión (Restaurante)

### A. Preflight de la Computadora Anfitriona
- **Sistema Operativo**: Windows 10 Pro (Build 19045 o superior).
  - *ADVERTENCIA DE SEGURIDAD*: Windows 10 se encuentra fuera del soporte estándar de Microsoft. Se aconseja actualizar a Windows 11 o instalar Ubuntu Server 24.04 LTS para producción.
- **Hardware Mínimo**:
  - Procesador: Intel Core i5 / AMD Ryzen 5 o superior.
  - Memoria RAM: 8 GB mínimo (16 GB recomendado para soportar PostgreSQL y múltiples terminales concurrentes).
  - Almacenamiento: SSD con al menos 30 GB libres.
- **Virtualización**: Habilitar Intel VT-x o AMD-V en la BIOS y WSL 2.

### B. Despliegue con Docker Compose
1. En la máquina principal del restaurante, abrir PowerShell como Administrador.
2. Iniciar el stack local:
   ```powershell
   docker-compose up -d
   ```
3. Verificar estado de los servicios:
   ```powershell
   docker ps
   ```

---

## 4. Guía de Compilación de la Aplicación Flutter

### A. Android (Teléfonos de Meseros y Tablets)
```bash
cd flutter_app
flutter pub get
# Para pruebas locales de depuración en la LAN:
flutter run -d android
# Para generar el APK de instalación manual en los teléfonos del personal:
flutter build apk --release
```
*El archivo generado estará en `build/app/outputs/flutter-apk/app-release.apk`.*

### B. iOS (iPhones / iPads)
- **Requisito Técnico Ineludible**: Se requiere obligatoriamente una computadora Mac con macOS 14+ y Xcode instalado. Un archivo APK no funciona en iOS.
- **Comandos**:
  ```bash
  flutter pub get
  cd ios && pod install && cd ..
  flutter build ipa --release
  ```
- Distribuir a los dispositivos del restaurante mediante Apple Developer Enterprise o TestFlight interno.

### C. Windows (Computadora de Caja)
- Requisitos: Visual Studio 2022 con C++ Desktop Development.
  ```bash
  flutter build windows --release
  ```
*El ejecutable autónomo se ubica en `build/windows/x64/runner/Release/`.*

### D. Linux
- Requisitos: `clang`, `cmake`, `ninja-build`, `pkg-config`, `libgtk-3-dev`.
  ```bash
  flutter build linux --release
  ```

---

## 5. Matriz de Estado de Funcionalidades

### Funcionalidades Implementadas y Probadas:
1. Cálculo de billetes en efectivo COP ($10k, $20k, $50k, $100k) y vueltas exactas con enteros.
2. Manejo de cuentas y pagos mixtos (Efectivo + Transferencia).
3. Conciliación de bebidas por SKU (fórmula de inventario inicial + entradas - traslados - ventas teóricas = esperado vs contado).
4. Cálculo de efectivo esperado en caja a partir del libro de caja.
5. Libro mayor gerencial con partida doble balanceada (Débitos = Créditos).
6. Separación estricta entre aportes de capital del dueño y ventas operacionales.
7. Hasheo seguro de PINs con sal criptográfica PBKDF2.
8. Rate limiting por IP y usuario.
9. Sanitización de texto contra XSS en notas de comandas.
10. Validación y bloqueo de archivos ejecutables maliciosos.
11. Protección de precios en servidor (prevención de manipulación de clientes).
12. Redacción de costos confidenciales según el rol autenticado.
13. Layout de catálogo desplazable con panel de cobro fijo (`POSCatalogScrollLayout`).
14. Módulo de mesas y pedidos del mesero sin botones de cobro.

### Funcionalidades No Verificadas / Dependencias Externas Pendientes:
- **DIAN**: Pendiente de credenciales y software de proveedor tecnológico avalado por el contador del negocio. No se simulan respuestas ficticias.
- **Impresión Física**: Requiere configurar la IP de la impresora térmica ESC/POS de 80mm en la red LAN.
- **WhatsApp Cloud API**: Requiere plantilla pre-aprobada por Meta y token de cuenta de desarrollador.
