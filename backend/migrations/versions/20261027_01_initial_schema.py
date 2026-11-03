"""initial schema 90 grados pos with expenses and pos_app roles

Revision ID: 20261027_01
Revises: 
Create Date: 2026-10-27 23:25:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20261027_01'
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. Version tracking table
    op.execute("""
    CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(32) PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota'),
        description TEXT NOT NULL
    );
    """)

    # 2. Schema creation from schema.sql
    op.execute("""
    DO $$ BEGIN
        CREATE TYPE user_role_type AS ENUM (
            'administrador', 'cajero', 'mesero', 'cocina_bar', 'inventario_contabilidad'
        );
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
        CREATE TYPE station_type AS ENUM ('cocina', 'bar');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
        CREATE TYPE order_status_type AS ENUM ('abierta', 'en_pago', 'pagada', 'cancelada');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
        CREATE TYPE kds_status_type AS ENUM ('recibido', 'en_preparacion', 'listo', 'entregado');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

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

    CREATE TABLE IF NOT EXISTS shift_sessions (
        id VARCHAR(64) PRIMARY KEY,
        center VARCHAR(64) NOT NULL,
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

    CREATE TABLE IF NOT EXISTS expenses (
        id VARCHAR(64) PRIMARY KEY,
        operational_date DATE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota'),
        shift_id VARCHAR(64) REFERENCES shift_sessions(id),
        shift_center VARCHAR(64),
        amount_cop INT NOT NULL CHECK (amount_cop > 0),
        category VARCHAR(64) NOT NULL,
        type VARCHAR(32) NOT NULL,
        description TEXT NOT NULL,
        third_party_name VARCHAR(128),
        third_party_nit VARCHAR(64),
        invoice_number VARCHAR(64),
        payment_method VARCHAR(32) NOT NULL,
        responsible_person VARCHAR(128),
        registered_by_user_id VARCHAR(64) NOT NULL REFERENCES users(id),
        status VARCHAR(32) NOT NULL DEFAULT 'aprobado',
        approved_by_user_id VARCHAR(64) REFERENCES users(id),
        approved_at TIMESTAMP WITH TIME ZONE,
        annulled_by_user_id VARCHAR(64) REFERENCES users(id),
        annulled_at TIMESTAMP WITH TIME ZONE,
        annulment_reason TEXT,
        related_expense_id VARCHAR(64),
        inventory_item_id VARCHAR(64) REFERENCES inventory_items(id),
        inventory_units_purchased NUMERIC(10, 2)
    );

    CREATE TABLE IF NOT EXISTS ledger_entries (
        id VARCHAR(64) PRIMARY KEY,
        date DATE NOT NULL,
        concept TEXT NOT NULL,
        debit_account VARCHAR(64) NOT NULL,
        credit_account VARCHAR(64) NOT NULL,
        amount_cop INT NOT NULL CHECK (amount_cop > 0),
        user_id VARCHAR(64) REFERENCES users(id),
        source_type VARCHAR(32) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(64) PRIMARY KEY,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota'),
        user_id VARCHAR(64) REFERENCES users(id),
        action VARCHAR(64) NOT NULL,
        entity VARCHAR(64) NOT NULL,
        details TEXT NOT NULL
    );
    """)


def downgrade() -> None:
    op.execute("""
    DROP TABLE IF EXISTS audit_logs CASCADE;
    DROP TABLE IF EXISTS ledger_entries CASCADE;
    DROP TABLE IF EXISTS expenses CASCADE;
    DROP TABLE IF EXISTS payments CASCADE;
    DROP TABLE IF EXISTS order_items CASCADE;
    DROP TABLE IF EXISTS orders CASCADE;
    DROP TABLE IF EXISTS shift_sessions CASCADE;
    DROP TABLE IF EXISTS inventory_items CASCADE;
    DROP TABLE IF EXISTS products CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    DROP TABLE IF EXISTS schema_migrations CASCADE;
    """)
