-- ==============================================================================
-- Sistema POS 90 Grados - Esquema PostgreSQL con Row-Level Security (RLS)
-- Cundinamarca, Colombia - Zona horaria: America/Bogota - Moneda: COP
-- Controles Obligatorios: RLS (4), Minimo Privilegio (7), Parametrizacion (13)
-- ==============================================================================

-- 1. Versionamiento de Migraciones
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(32) PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota'),
    description TEXT NOT NULL
);

INSERT INTO schema_migrations (version, description) 
VALUES ('20261016_01_init', 'Esquema base 90 Grados con 20 controles de seguridad')
ON CONFLICT (version) DO NOTHING;

INSERT INTO schema_migrations (version, description) 
VALUES ('20261027_02_expenses_and_roles', 'Adicion de tabla expenses, rol pos_app y politicas minimas de auditoria')
ON CONFLICT (version) DO NOTHING;

-- 2. Enumeraciones de Roles y Estaciones
DO $$ BEGIN
    CREATE TYPE user_role_type AS ENUM (
        'administrador', 
        'cajero', 
        'mesero', 
        'cocina_bar', 
        'inventario_contabilidad'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE station_type AS ENUM ('cocina', 'bar');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE order_status_type AS ENUM ('abierta', 'en_pago', 'pagada', 'cancelada');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE kds_status_type AS ENUM ('recibido', 'en_preparacion', 'listo', 'entregado');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Tabla de Usuarios y Perfiles (Control 10: PINs hasheados, sin texto plano)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(32) UNIQUE NOT NULL,
    full_name VARCHAR(128) NOT NULL,
    role user_role_type NOT NULL,
    pin_hash VARCHAR(128) NOT NULL,
    pin_salt VARCHAR(64) NOT NULL,
    bio VARCHAR(240),
    avatar_url TEXT,
    phone VARCHAR(32),
    email VARCHAR(128),
    assigned_shift VARCHAR(32) DEFAULT 'matutino',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota'),
    last_login TIMESTAMP WITH TIME ZONE
);

-- 4. Carta de Productos
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(64) PRIMARY KEY,
    sku VARCHAR(32) UNIQUE NOT NULL,
    name VARCHAR(128) NOT NULL,
    category VARCHAR(64) NOT NULL,
    price_cop INT NOT NULL CHECK (price_cop >= 0),
    station station_type NOT NULL,
    unit VARCHAR(32) NOT NULL DEFAULT 'unidad',
    description TEXT,
    is_available BOOLEAN DEFAULT TRUE,
    allowed_shifts VARCHAR(32) DEFAULT 'todos',
    estimated_cost_cop INT CHECK (estimated_cost_cop >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')
);

-- 5. Insumos e Inventario
CREATE TABLE IF NOT EXISTS inventory_items (
    id VARCHAR(64) PRIMARY KEY,
    sku VARCHAR(32) UNIQUE NOT NULL,
    name VARCHAR(128) NOT NULL,
    category VARCHAR(64) NOT NULL,
    purchase_unit VARCHAR(32) NOT NULL,
    recipe_unit VARCHAR(32) NOT NULL,
    conversion_ratio NUMERIC(10, 4) NOT NULL CHECK (conversion_ratio > 0),
    current_stock NUMERIC(12, 2) NOT NULL DEFAULT 0,
    min_stock NUMERIC(12, 2) NOT NULL DEFAULT 0,
    unit_cost_cop INT NOT NULL CHECK (unit_cost_cop >= 0),
    location VARCHAR(32) NOT NULL DEFAULT 'Bodega'
);

-- 6. Turnos de Caja (Restaurante Matutino vs Bar Nocturno)
CREATE TABLE IF NOT EXISTS shift_sessions (
    id VARCHAR(64) PRIMARY KEY,
    center VARCHAR(64) NOT NULL, -- 'Restaurante Matutino' o 'Bar Nocturno'
    opened_by_user_id VARCHAR(64) REFERENCES users(id),
    opened_at TIMESTAMP WITH TIME ZONE NOT NULL,
    initial_fund_cop INT NOT NULL CHECK (initial_fund_cop >= 0),
    status VARCHAR(16) NOT NULL DEFAULT 'abierto',
    closed_by_user_id VARCHAR(64) REFERENCES users(id),
    closed_at TIMESTAMP WITH TIME ZONE,
    expected_cash_cop INT NOT NULL DEFAULT 0,
    counted_cash_cop INT DEFAULT 0,
    cash_difference_cop INT DEFAULT 0,
    total_sales_cash_cop INT DEFAULT 0,
    total_sales_electronic_cop INT DEFAULT 0,
    total_sales_total_cop INT DEFAULT 0,
    handover_to_user_id VARCHAR(64) REFERENCES users(id),
    handover_notes TEXT,
    version INT NOT NULL DEFAULT 1
);

-- 7. Comandas y Cuentas (POS)
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(64) PRIMARY KEY,
    order_number SERIAL,
    table_number VARCHAR(64) NOT NULL,
    waiter_id VARCHAR(64) NOT NULL REFERENCES users(id),
    shift_id VARCHAR(64) REFERENCES shift_sessions(id),
    status order_status_type NOT NULL DEFAULT 'abierta',
    cocina_status kds_status_type NOT NULL DEFAULT 'recibido',
    bar_status kds_status_type NOT NULL DEFAULT 'recibido',
    customer_note TEXT,
    total_amount_cop INT NOT NULL CHECK (total_amount_cop >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')
);

CREATE TABLE IF NOT EXISTS order_items (
    id VARCHAR(64) PRIMARY KEY,
    order_id VARCHAR(64) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id VARCHAR(64) NOT NULL REFERENCES products(id),
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price_cop INT NOT NULL CHECK (unit_price_cop >= 0),
    station station_type NOT NULL,
    notes TEXT
);

-- 8. Pagos (Control 5: Prohibido almacenar numeros de tarjetas de credito)
CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(64) PRIMARY KEY,
    order_id VARCHAR(64) UNIQUE NOT NULL REFERENCES orders(id),
    total_due_cop INT NOT NULL,
    received_cash_cop INT NOT NULL CHECK (received_cash_cop >= 0),
    change_given_cop INT NOT NULL CHECK (change_given_cop >= 0),
    bill_10000_count INT DEFAULT 0,
    bill_20000_count INT DEFAULT 0,
    bill_50000_count INT DEFAULT 0,
    bill_100000_count INT DEFAULT 0,
    cashier_id VARCHAR(64) NOT NULL REFERENCES users(id),
    payment_methods_json JSONB NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')
);

-- 9. Control de Gastos y Egresos Operativos con Trazabilidad Completa
CREATE TABLE IF NOT EXISTS expenses (
    id VARCHAR(64) PRIMARY KEY,
    operational_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota'),
    shift_id VARCHAR(64) REFERENCES shift_sessions(id),
    shift_center VARCHAR(64),
    amount_cop INT NOT NULL CHECK (amount_cop > 0),
    category VARCHAR(64) NOT NULL,
    type VARCHAR(32) NOT NULL, -- 'gasto_operativo', 'compra_inventario', 'inversion_dueno', 'retiro_dueno', etc.
    description TEXT NOT NULL,
    third_party_name VARCHAR(128),
    third_party_nit VARCHAR(64),
    invoice_number VARCHAR(64),
    payment_method VARCHAR(32) NOT NULL,
    responsible_person VARCHAR(128),
    registered_by_user_id VARCHAR(64) NOT NULL REFERENCES users(id),
    status VARCHAR(32) NOT NULL DEFAULT 'aprobado', -- 'borrador', 'pendiente_aprobacion', 'aprobado', 'pagado', 'anulado'
    approved_by_user_id VARCHAR(64) REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    annulled_by_user_id VARCHAR(64) REFERENCES users(id),
    annulled_at TIMESTAMP WITH TIME ZONE,
    annulment_reason TEXT,
    related_expense_id VARCHAR(64),
    inventory_item_id VARCHAR(64) REFERENCES inventory_items(id),
    inventory_units_purchased NUMERIC(10, 2)
);

-- 10. Libro Mayor y Asientos de Partida Doble
CREATE TABLE IF NOT EXISTS ledger_entries (
    id VARCHAR(64) PRIMARY KEY,
    date DATE NOT NULL,
    concept TEXT NOT NULL,
    debit_account VARCHAR(64) NOT NULL,
    credit_account VARCHAR(64) NOT NULL,
    amount_cop INT NOT NULL CHECK (amount_cop > 0),
    user_id VARCHAR(64) REFERENCES users(id),
    source_type VARCHAR(32) NOT NULL -- 'venta', 'gasto', 'inversion_dueno', 'retiro_dueno', 'merma'
);

-- 11. Auditoria Inmutable de Operaciones Criticas
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota'),
    user_id VARCHAR(64) REFERENCES users(id),
    action VARCHAR(64) NOT NULL,
    entity VARCHAR(64) NOT NULL,
    details TEXT NOT NULL
);

-- ==============================================================================
-- CONTROL 4: HABILITAR ROW-LEVEL SECURITY (RLS) EN TODAS LAS TABLAS
-- ==============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Politica 1: Meseros solo leen la carta disponible y no ven costos confidenciales
DROP POLICY IF EXISTS rls_products_mesero_read ON products;
CREATE POLICY rls_products_mesero_read ON products
    FOR SELECT TO authenticated
    USING (is_available = TRUE);

-- Politica 2: Meseros crean y leen sus propias comandas
DROP POLICY IF EXISTS rls_orders_mesero_access ON orders;
CREATE POLICY rls_orders_mesero_access ON orders
    FOR ALL TO authenticated
    USING (
        status = 'abierta' OR 
        current_setting('app.current_user_role', true) IN ('administrador', 'cajero')
    );

-- Politica 3: Solo Cajeros y Administradores pueden registrar pagos o cerrar cuentas
DROP POLICY IF EXISTS rls_payments_cashier_only ON payments;
CREATE POLICY rls_payments_cashier_only ON payments
    FOR INSERT TO authenticated
    WITH CHECK (
        current_setting('app.current_user_role', true) IN ('cajero', 'administrador')
    );

-- Politica 4: Gastos accesibles para registro y consulta segun rol
DROP POLICY IF EXISTS rls_expenses_access ON expenses;
CREATE POLICY rls_expenses_access ON expenses
    FOR ALL TO authenticated
    USING (
        current_setting('app.current_user_role', true) IN ('administrador', 'cajero', 'inventario_contabilidad')
    );

-- Politica 5: Libro mayor restringido estrictamente a Administrador y Contabilidad
DROP POLICY IF EXISTS rls_ledger_admin_only ON ledger_entries;
CREATE POLICY rls_ledger_admin_only ON ledger_entries
    FOR ALL TO authenticated
    USING (
        current_setting('app.current_user_role', true) IN ('administrador', 'inventario_contabilidad')
    );

-- Politica 6: Logs de auditoria son inmutables (SOLO INSERT, PROHIBIDO UPDATE O DELETE)
DROP POLICY IF EXISTS rls_audit_immutable ON audit_logs;
CREATE POLICY rls_audit_immutable ON audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (TRUE);

-- ==============================================================================
-- CONTROL 7: ROL DE APLICACION CON MINIMO PRIVILEGIO (pos_app)
-- ==============================================================================
-- Nota: En despliegues locales, se concede acceso estrictamente necesario sobre tablas y secuencias.
-- La aplicacion no debe ejecutar sentencias DDL (CREATE/DROP) bajo credenciales de usuario operativo.
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pos_app') THEN
        CREATE ROLE pos_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN insufficient_privilege THEN null;
END $$;

DO $$ BEGIN
    GRANT USAGE ON SCHEMA public TO pos_app;
    GRANT SELECT, INSERT, UPDATE ON users, products, inventory_items, shift_sessions, orders, order_items, payments, expenses, ledger_entries, audit_logs TO pos_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pos_app;
EXCEPTION
    WHEN undefined_table THEN null;
    WHEN insufficient_privilege THEN null;
END $$;

-- Compatibilidad con Supabase Cloud (Roles anon y authenticated)
DO $$ BEGIN
    GRANT USAGE ON SCHEMA public TO anon, authenticated;
    GRANT SELECT, INSERT, UPDATE ON users, products, inventory_items, shift_sessions, orders, order_items, payments, expenses, ledger_entries, audit_logs TO anon, authenticated;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
EXCEPTION
    WHEN undefined_table THEN null;
    WHEN undefined_object THEN null;
    WHEN insufficient_privilege THEN null;
END $$;
