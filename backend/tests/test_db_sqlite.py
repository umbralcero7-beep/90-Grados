"""
Suite de Pruebas de Base de Datos SQLite (Entorno de Ensayo Ligero) - 90 Grados
Valida creación de tablas fundamentales, inserción de comandas y registro de egresos
utilizando la biblioteca estándar 'sqlite3' de Python.
"""

import sqlite3
import unittest
from datetime import datetime

class TestDBSqlite(unittest.TestCase):

    def setUp(self):
        # Conexión estrictamente en memoria (RAM)
        self.conn = sqlite3.connect(":memory:")
        self.cursor = self.conn.cursor()
        self._init_sqlite_schema()

    def tearDown(self):
        self.conn.close()

    def _init_sqlite_schema(self):
        self.cursor.executescript("""
        CREATE TABLE users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            full_name TEXT NOT NULL,
            role TEXT NOT NULL,
            pin_hash TEXT NOT NULL,
            pin_salt TEXT NOT NULL,
            assigned_shift TEXT DEFAULT 'matutino',
            is_active INTEGER DEFAULT 1
        );

        CREATE TABLE products (
            id TEXT PRIMARY KEY,
            sku TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            price_cop INTEGER NOT NULL CHECK (price_cop >= 0),
            station TEXT NOT NULL,
            is_available INTEGER DEFAULT 1
        );

        CREATE TABLE shift_sessions (
            id TEXT PRIMARY KEY,
            center TEXT NOT NULL,
            opened_by_user_id TEXT,
            initial_fund_cop INTEGER NOT NULL,
            status TEXT DEFAULT 'abierto',
            expected_cash_cop INTEGER DEFAULT 0,
            counted_cash_cop INTEGER DEFAULT 0,
            FOREIGN KEY (opened_by_user_id) REFERENCES users(id)
        );

        CREATE TABLE orders (
            id TEXT PRIMARY KEY,
            table_number TEXT NOT NULL,
            waiter_id TEXT NOT NULL,
            shift_id TEXT,
            status TEXT DEFAULT 'abierta',
            total_amount_cop INTEGER NOT NULL,
            FOREIGN KEY (waiter_id) REFERENCES users(id),
            FOREIGN KEY (shift_id) REFERENCES shift_sessions(id)
        );

        CREATE TABLE expenses (
            id TEXT PRIMARY KEY,
            operational_date TEXT NOT NULL,
            shift_id TEXT,
            amount_cop INTEGER NOT NULL CHECK (amount_cop > 0),
            category TEXT NOT NULL,
            type TEXT NOT NULL,
            description TEXT NOT NULL,
            payment_method TEXT NOT NULL,
            registered_by_user_id TEXT NOT NULL,
            status TEXT DEFAULT 'aprobado',
            annulment_reason TEXT,
            FOREIGN KEY (registered_by_user_id) REFERENCES users(id),
            FOREIGN KEY (shift_id) REFERENCES shift_sessions(id)
        );
        """)
        self.conn.commit()

    def test_insercion_y_consulta_usuarios(self):
        self.cursor.execute(
            "INSERT INTO users (id, username, full_name, role, pin_hash, pin_salt) VALUES (?, ?, ?, ?, ?, ?)",
            ("usr-1", "carmen_gerente", "Carmen Elena Morales", "administrador", "hash1", "salt1")
        )
        self.conn.commit()

        self.cursor.execute("SELECT username, role FROM users WHERE id = ?", ("usr-1",))
        row = self.cursor.fetchone()
        self.assertIsNotNone(row)
        self.assertEqual(row[0], "carmen_gerente")
        self.assertEqual(row[1], "administrador")

    def test_orden_con_atribucion_a_mesero(self):
        # Crear mesero y turno
        self.cursor.execute("INSERT INTO users VALUES ('usr-3', 'mateo_mesero', 'Mateo Silva', 'mesero', 'h', 's', 'ambos', 1)")
        self.cursor.execute("INSERT INTO shift_sessions VALUES ('sh-1', 'Restaurante Matutino', 'usr-3', 200000, 'abierto', 200000, 0)")
        
        # Crear orden atribuida
        self.cursor.execute(
            "INSERT INTO orders (id, table_number, waiter_id, shift_id, status, total_amount_cop) VALUES (?, ?, ?, ?, ?, ?)",
            ("ord-101", "Mesa 4", "usr-3", "sh-1", "abierta", 85000)
        )
        self.conn.commit()

        self.cursor.execute("SELECT waiter_id, total_amount_cop FROM orders WHERE id = 'ord-101'")
        ord_row = self.cursor.fetchone()
        self.assertEqual(ord_row[0], "usr-3")
        self.assertEqual(ord_row[1], 85000)

    def test_registro_y_anulacion_de_gastos(self):
        self.cursor.execute("INSERT INTO users VALUES ('usr-2', 'diana_caja', 'Diana Torres', 'cajero', 'h', 's', 'matutino', 1)")
        self.cursor.execute(
            "INSERT INTO expenses (id, operational_date, shift_id, amount_cop, category, type, description, payment_method, registered_by_user_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            ("exp-01", "2026-10-27", None, 35000, "Suministros & Aseo", "gasto_operativo", "Cloro y toallas cocina", "efectivo_caja", "usr-2", "aprobado")
        )
        self.conn.commit()

        # Anulación
        motivo = "Compra cancelada proveedor no tenía factura"
        self.cursor.execute("UPDATE expenses SET status = 'anulado', annulment_reason = ? WHERE id = 'exp-01'", (motivo,))
        self.conn.commit()

        self.cursor.execute("SELECT status, annulment_reason FROM expenses WHERE id = 'exp-01'")
        exp_row = self.cursor.fetchone()
        self.assertEqual(exp_row[0], "anulado")
        self.assertEqual(exp_row[1], motivo)

if __name__ == '__main__':
    unittest.main()
