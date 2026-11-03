# GUÍA DEFINITIVA: SUPABASE CLOUD, OPERACIÓN OFFLINE Y APK MESEROS
**Sistema POS / ERP “90 Grados” — Cundinamarca, Colombia**

---

## 1. Conexión con Supabase Cloud (PostgreSQL en la Nube)

Usted solo debe crear el proyecto en Supabase y copiar dos datos (URL y anon key). El sistema se encarga del resto.

### Paso 1: Crear el Proyecto en Supabase
1. Ingrese a [supabase.com](https://supabase.com) e inicie sesión (o cree una cuenta gratuita).
2. Haga clic en **"New Project"**.
3. Elija un nombre para el proyecto (ej. `90-grados-pos`) y seleccione la región más cercana (ej. `South America (São Paulo)` o `US East`).
4. Ingrese una contraseña para la base de datos (guárdela de forma privada; el POS no la necesitará directamente).

### Paso 2: Crear las Tablas con el Script Oficial
1. En el panel izquierdo de su proyecto Supabase, haga clic en el ícono **SQL Editor**.
2. Haga clic en **"New Query"**.
3. Abra el archivo `entrega_piloto_90grados/supabase_schema.sql` (o `backend/database/schema.sql`), copie todo su contenido y péguelo en el editor de Supabase.
4. Haga clic en el botón verde **"Run"**.
   - Esto creará todas las tablas: `users`, `products`, `orders`, `order_items`, `payments`, `shift_sessions`, `inventory_items`, `expenses`, `ledger_entries` y `audit_logs` con seguridad Row-Level Security (RLS) y permisos para la anon key.

### Paso 3: Copiar la URL y la API Key al POS
1. En el panel izquierdo de Supabase, vaya a **Project Settings** (ícono de engranaje) → **API**.
2. En la sección **Project URL**, copie la URL (ej. `https://xyzabcdefghijklm.supabase.co`).
3. En la sección **Project API keys**, copie la clave pública identificada como **`anon` `public`**.
4. Abra el POS 90 Grados, inicie sesión como Administrador (`@carmen_gerente` / PIN `1234`) y vaya al módulo **Configuración del Sistema**.
5. En la tarjeta **"Conexión Supabase Cloud (PostgreSQL Remoto & Despliegue Web)"**, pegue la URL y la Anon Key.
6. Haga clic en **"Probar Conexión Supabase"**: el sistema comprobará la comunicación en milisegundos y confirmará las tablas activas.
7. Haga clic en **"Guardar Claves"**.

### Paso 4: Sincronizar en Cualquier Momento
- En la misma tarjeta, el botón **"Sincronizar Comandas y Gastos a Supabase"** subirá las comandas pagadas y los egresos de caja registrados localmente, garantizando un respaldo inmutable en la nube.

---

## 2. Garantía Técnica: ¿Qué Pasa si se Cae el Internet?

> **Respuesta contundente:** El restaurante **sigue funcionando al 100% de manera normal**. No se detiene la toma de pedidos, no se detiene la cocina/bar y no se detiene el cobro ni la impresión de recibos.

### ¿Por qué funciona sin internet? (Arquitectura Local-First)
1. **La red Wi-Fi interna no depende de Internet:** El router físico del restaurante emite la red Wi-Fi local (ej. `90Grados_POS_Local`). Los celulares de los meseros y el computador All-in-One de caja están conectados a esa misma red. Si el cable de fibra óptica exterior se corta, los paquetes de datos entre los celulares y el All-in-One siguen circulando instantáneamente por el router local.
2. **La autoridad de datos es el equipo All-in-One de caja:** El backend FastAPI y la base de datos corren en el computador de caja (`http://192.168.1.150:8000`). Los celulares de los meseros envían los pedidos directamente a esa dirección IP local.
3. **Flujo de pedidos garantizado:**
   - El mesero selecciona la mesa y los productos en su tablet/celular.
   - Presiona **"Enviar Comanda a Cocina y Bar"**.
   - La orden llega por la red Wi-Fi local al All-in-One de caja.
   - La pantalla KDS de Cocina y Bar actualiza el pedido en tiempo real.
   - La impresora térmica (conectada por USB al All-in-One o por cable de red local) imprime la comanda de cocina de 58 mm / 80 mm sin requerir internet.
4. **Cierre de cuentas e impresión de facturas:** El cajero ve la mesa en la pantalla de caja, recibe el dinero o datáfono, cierra la cuenta e imprime el ticket de caja directamente por USB/LAN.
5. **Sincronización diferida cuando regrese el internet:** Cuando el proveedor de internet restablezca el servicio, los datos acumulados se sincronizan a Supabase Cloud con un solo clic o de forma automática en segundo plano.

---

## 3. Seguridad de Roles: El Mesero NO Puede Cobrar

Se ha blindado el código en 4 capas independientes para impedir que un mesero cobre, vea la caja o cierre cuentas:

1. **Matriz de Permisos (`src/data/initialData.ts`):**
   - El rol `mesero` tiene asignado en el módulo POS (`terminal de caja`):
     ```typescript
     pos: { consultar: false, crear: false, editar: false, anular: false, cerrar: false, administrar: false }
     ```
2. **Aislamiento de Vistas en el Frontend (`src/App.tsx`):**
   - Si el usuario autenticado tiene el rol `mesero`, el sistema intercepta cualquier intento de navegación y **lo bloquea de forma forzosa exclusivamente en la vista de toma de pedidos (`activeView = 'waiter'`)**.
   - Aunque intente cambiar la URL o la vista en pantalla, el sistema no le permite salir del módulo de meseros.
3. **Ocultamiento de Menús en la Interfaz (`src/components/AppSidebarRail.tsx`):**
   - El botón de "Terminal POS (Caja)", "Gastos & Libro Mayor", "Turnos & Cierres" y "Panel del Dueño" no aparecen en la barra de navegación del mesero. Solo ve:
     - 🛎️ *Toma de Pedidos (Salón & Terraza)*
4. **Sin Botones de Cobro en la Pantalla del Mesero (`src/components/WaiterModule.tsx`):**
   - La interfaz del mesero solo contiene:
     - Selección de mesa.
     - Catálogo de productos (con categorías y filtros).
     - Selección de acompañamientos y notas especiales.
     - Botón **"Enviar Comanda a Cocina y Bar"**.
     - Botón **"Solicitar Cuenta a Caja"** (el cual no cobra, solo marca la mesa con alerta para que el cajero imprima la pre-cuenta).
5. **Reglas a Nivel de Base de Datos (RLS en PostgreSQL / Supabase):**
   - La política de seguridad `rls_payments_cashier_only` en `backend/database/schema.sql` rechaza en la base de datos cualquier inserción en la tabla de pagos que no provenga de un usuario con rol `cajero` o `administrador`.

---

## 4. Instrucciones para Generar la APK de Meseros (Android)

La aplicación ya está configurada con Capacitor (`capacitor.config.ts`), orientada a pantalla vertical táctil para celulares y tablets Android.

### Requisitos previos en su computador (con Windows 11 o Mac/Linux):
- Node.js versión 18 o 20 instalada.
- Android Studio instalado (incluye Android SDK y Gradle).

### Pasos para compilar la APK:
1. Abra la terminal en la carpeta del proyecto y compile el frontend optimizado:
   ```bash
   npm install
   npm run build
   ```
2. Instale Capacitor en el proyecto si aún no ha inicializado la carpeta Android:
   ```bash
   npm install @capacitor/core @capacitor/cli @capacitor/android
   npx cap add android
   ```
3. Copie los archivos compilados a la carpeta nativa de Android:
   ```bash
   npx cap sync android
   ```
4. Abra el proyecto en Android Studio:
   ```bash
   npx cap open android
   ```
5. En Android Studio:
   - Espere que Gradle termine de indexar (1 o 2 minutos).
   - Vaya al menú superior: **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
   - En unos segundos aparecerá una notificación abajo a la derecha: *"APK(s) generated successfully"*.
   - Haga clic en **locate**: allí encontrará el archivo `app-debug.apk`.
6. Envíe ese archivo `.apk` a los teléfonos de los meseros por WhatsApp, Google Drive o cable USB e instálelo (activando "Permitir instalar aplicaciones de orígenes desconocidos").

### Configuración de la IP en la APK del Mesero:
- Al abrir la app en el celular del mesero, ingrese al menú de configuración o guarde la URL de la red local:
  `http://192.168.1.150:8000` (reemplazando `192.168.1.150` por la IP real del equipo All-in-One de caja).
- Inicie sesión con el usuario de prueba `@mateo_mesero` (PIN `3456`) y verá de inmediato su pantalla exclusiva de toma de pedidos.
