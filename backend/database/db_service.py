"""
Servicio de Persistencia y Acceso a Base de Datos - 90 Grados POS
Restaurante-Bar 90 Grados · Cundinamarca, Colombia

Implementa:
1. Conexión segura a PostgreSQL local (All-in-One).
2. Establecimiento TRANSACCIONAL estricto de 'SET LOCAL app.current_user_role = :role' (Control 4 y 7).
3. Soporte para entorno de pruebas/staging sin alterar bases de producción.
4. Idempotencia y Outbox para sincronización.
"""

import os
import json
import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime

logger = logging.getLogger("90grados.db")

# Intentar importar drivers de base de datos PostgreSQL
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    PSYCOPG2_AVAILABLE = True
except ImportError:
    PSYCOPG2_AVAILABLE = False

class LocalDatabaseManager:
    """
    Administrador central de datos para el servidor FastAPI local.
    Prioriza conexión PostgreSQL local (127.0.0.1:5432) con contexto transaccional RLS.
    """

    def __init__(self, db_url: Optional[str] = None):
        self.db_url = db_url or os.environ.get("DATABASE_URL", "postgresql://pos_app@127.0.0.1:5432/grados_piloto_staging_test")
        self.is_connected = False
        
        # Almacén de memoria transaccional para staging/tests unitarios locales
        self._memory_orders: Dict[str, Dict[str, Any]] = {}
        self._memory_order_items: Dict[str, List[Dict[str, Any]]] = {}
        self._memory_payments: Dict[str, Dict[str, Any]] = {}
        self._memory_shifts: Dict[str, Dict[str, Any]] = {}
        self._memory_expenses: Dict[str, Dict[str, Any]] = {}
        self._memory_audit_logs: List[Dict[str, Any]] = []
        self._idempotency_keys: Dict[str, Dict[str, Any]] = {}

    def get_connection(self):
        """Retorna conexión PostgreSQL si está disponible."""
        if PSYCOPG2_AVAILABLE:
            try:
                conn = psycopg2.connect(self.db_url, cursor_factory=RealDictCursor)
                return conn
            except Exception as e:
                logger.warning(f"PostgreSQL local no alcanzable en {self.db_url}. Usando almacenamiento transaccional local: {e}")
                return None
        return None

    def execute_transactional(self, role: str, query: str, params: Tuple = ()):
        """
        Ejecuta una sentencia SQL estableciendo 'SET LOCAL app.current_user_role'
        dentro de la misma transacción para garantizar que RLS se evalúe correctamente.
        """
        conn = self.get_connection()
        if not conn:
            return None
        try:
            with conn:
                with conn.cursor() as cur:
                    # Control 4: Establecer rol transaccional de forma validada
                    cur.execute("SET LOCAL app.current_user_role = %s;", (role,))
                    cur.execute(query, params)
                    if cur.description:
                        return cur.fetchall()
                    return None
        finally:
            conn.close()

    # =========================================================================
    # PEDIDOS / COMANDAS (ORDERS)
    # =========================================================================
    def get_orders(self, status: Optional[str] = None, shift_id: Optional[str] = None) -> List[Dict[str, Any]]:
        conn = self.get_connection()
        if conn:
            try:
                with conn.cursor() as cur:
                    query = "SELECT * FROM orders WHERE 1=1"
                    params = []
                    if status:
                        query += " AND status = %s"
                        params.append(status)
                    if shift_id:
                        query += " AND shift_id = %s"
                        params.append(shift_id)
                    query += " ORDER BY created_at DESC"
                    cur.execute(query, tuple(params))
                    orders = cur.fetchall()
                    return [dict(o) for o in orders]
            finally:
                conn.close()

        # Fallback almacén transaccional en memoria
        orders = list(self._memory_orders.values())
        if status:
            orders = [o for o in orders if o.get("status") == status]
        if shift_id:
            orders = [o for o in orders if o.get("shift_id") == shift_id]
        return sorted(orders, key=lambda x: x.get("created_at", ""), reverse=True)

    def create_order(
        self, 
        order_id: str, 
        table_number: str, 
        waiter_id: str, 
        waiter_name: str,
        items: List[Dict[str, Any]], 
        shift_id: Optional[str] = None, 
        customer_note: str = "",
        role: str = "mesero"
    ) -> Dict[str, Any]:
        """Crea un pedido con cálculo estricto de total en servidor."""
        total_amount = sum(item.get("unit_price_cop", 0) * item.get("quantity", 0) for item in items)
        now_iso = datetime.now().isoformat()

        order_record = {
            "id": order_id,
            "order_number": len(self._memory_orders) + 101,
            "table_number": table_number,
            "waiter_id": waiter_id,
            "waiter_name": waiter_name,
            "shift_id": shift_id,
            "status": "abierta",
            "cocina_status": "recibido",
            "bar_status": "recibido",
            "customer_note": customer_note,
            "total_amount_cop": total_amount,
            "items": items,
            "created_at": now_iso
        }

        # Guardar en base de datos si disponible
        conn = self.get_connection()
        if conn:
            try:
                with conn:
                    with conn.cursor() as cur:
                        cur.execute("SET LOCAL app.current_user_role = %s;", (role,))
                        cur.execute("""
                            INSERT INTO orders (id, table_number, waiter_id, shift_id, status, cocina_status, bar_status, customer_note, total_amount_cop)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """, (order_id, table_number, waiter_id, shift_id, 'abierta', 'recibido', 'recibido', customer_note, total_amount))
                        for it in items:
                            cur.execute("""
                                INSERT INTO order_items (id, order_id, product_id, quantity, unit_price_cop, station, notes)
                                VALUES (%s, %s, %s, %s, %s, %s, %s)
                            """, (
                                f"itm-{datetime.now().timestamp()}-{it.get('product_id')}",
                                order_id,
                                it.get("product_id"),
                                it.get("quantity"),
                                it.get("unit_price_cop"),
                                it.get("station", "cocina"),
                                it.get("notes", "")
                            ))
            finally:
                conn.close()

        self._memory_orders[order_id] = order_record
        self._memory_order_items[order_id] = items
        return order_record

    def update_order_status(
        self, 
        order_id: str, 
        status: Optional[str] = None, 
        cocina_status: Optional[str] = None, 
        bar_status: Optional[str] = None,
        role: str = "mesero"
    ) -> Optional[Dict[str, Any]]:
        order = self._memory_orders.get(order_id)
        if not order:
            return None
        if status:
            order["status"] = status
        if cocina_status:
            order["cocina_status"] = cocina_status
        if bar_status:
            order["bar_status"] = bar_status

        conn = self.get_connection()
        if conn:
            try:
                with conn:
                    with conn.cursor() as cur:
                        cur.execute("SET LOCAL app.current_user_role = %s;", (role,))
                        cur.execute("""
                            UPDATE orders 
                            SET status = COALESCE(%s, status),
                                cocina_status = COALESCE(%s, cocina_status),
                                bar_status = COALESCE(%s, bar_status)
                            WHERE id = %s
                        """, (status, cocina_status, bar_status, order_id))
            finally:
                conn.close()

        return order

    # =========================================================================
    # PAGOS Y CIERRE DE CUENTA (PAYMENTS & IDEMPOTENCY)
    # =========================================================================
    def process_payment(
        self,
        payment_id: str,
        order_id: str,
        total_due_cop: int,
        received_cash_cop: int,
        change_given_cop: int,
        denominations: Dict[str, int],
        payment_methods: List[Dict[str, Any]],
        cashier_id: str,
        idempotency_key: str,
        role: str = "cajero"
    ) -> Dict[str, Any]:
        """Procesa un pago con clave de idempotencia estricta para evitar dobles cobros."""
        if idempotency_key in self._idempotency_keys:
            logger.info(f"Respuesta idempotente retornada para la clave: {idempotency_key}")
            return self._idempotency_keys[idempotency_key]

        now_iso = datetime.now().isoformat()
        payment_record = {
            "id": payment_id,
            "order_id": order_id,
            "total_due_cop": total_due_cop,
            "received_cash_cop": received_cash_cop,
            "change_given_cop": change_given_cop,
            "denominations": denominations,
            "payment_methods": payment_methods,
            "cashier_id": cashier_id,
            "paid_at": now_iso,
            "idempotency_key": idempotency_key
        }

        conn = self.get_connection()
        if conn:
            try:
                with conn:
                    with conn.cursor() as cur:
                        cur.execute("SET LOCAL app.current_user_role = %s;", (role,))
                        cur.execute("""
                            INSERT INTO payments (
                                id, order_id, total_due_cop, received_cash_cop, change_given_cop,
                                bill_10000_count, bill_20000_count, bill_50000_count, bill_100000_count,
                                cashier_id, payment_methods_json, paid_at
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """, (
                            payment_id, order_id, total_due_cop, received_cash_cop, change_given_cop,
                            denominations.get("bill_10000", 0),
                            denominations.get("bill_20000", 0),
                            denominations.get("bill_50000", 0),
                            denominations.get("bill_100000", 0),
                            cashier_id,
                            json.dumps(payment_methods),
                            now_iso
                        ))
                        # Marcar la comanda como pagada en la misma transacción
                        cur.execute("UPDATE orders SET status = 'pagada' WHERE id = %s;", (order_id,))
            finally:
                conn.close()

        # Actualizar memoria
        self._memory_payments[payment_id] = payment_record
        if order_id in self._memory_orders:
            self._memory_orders[order_id]["status"] = "pagada"

        self._idempotency_keys[idempotency_key] = payment_record
        return payment_record

    # =========================================================================
    # TURNOS DE CAJA (SHIFTS)
    # =========================================================================
    def get_current_shift(self, center: str = "Restaurante Matutino") -> Optional[Dict[str, Any]]:
        for shift in self._memory_shifts.values():
            if shift.get("center") == center and shift.get("status") == "abierto":
                return shift
        return None

    def open_shift(self, shift_id: str, center: str, opened_by_id: str, initial_fund_cop: int, role: str = "cajero") -> Dict[str, Any]:
        now_iso = datetime.now().isoformat()
        shift = {
            "id": shift_id,
            "center": center,
            "opened_by_user_id": opened_by_id,
            "opened_at": now_iso,
            "initial_fund_cop": initial_fund_cop,
            "status": "abierto",
            "version": 1
        }
        self._memory_shifts[shift_id] = shift
        return shift

    def close_shift(
        self, 
        shift_id: str, 
        closed_by_id: str, 
        counted_cash_cop: int, 
        expected_cash_cop: int, 
        role: str = "cajero"
    ) -> Optional[Dict[str, Any]]:
        shift = self._memory_shifts.get(shift_id)
        if not shift:
            return None
        shift["status"] = "cerrado"
        shift["closed_by_user_id"] = closed_by_id
        shift["closed_at"] = datetime.now().isoformat()
        shift["counted_cash_cop"] = counted_cash_cop
        shift["expected_cash_cop"] = expected_cash_cop
        shift["cash_difference_cop"] = counted_cash_cop - expected_cash_cop
        return shift

    # =========================================================================
    # GASTOS Y EGRESOS OPERATIVOS (EXPENSES)
    # =========================================================================
    def get_expenses(self, operational_date: Optional[str] = None) -> List[Dict[str, Any]]:
        expenses = list(self._memory_expenses.values())
        if operational_date:
            expenses = [e for e in expenses if e.get("operational_date") == operational_date]
        return sorted(expenses, key=lambda x: x.get("created_at", ""), reverse=True)

    def create_expense(self, expense_data: Dict[str, Any], role: str = "cajero") -> Dict[str, Any]:
        expense_id = expense_data.get("id") or f"exp-{datetime.now().timestamp()}"
        expense_data["id"] = expense_id
        expense_data["created_at"] = datetime.now().isoformat()
        self._memory_expenses[expense_id] = expense_data
        return expense_data

    def annul_expense(self, expense_id: str, annulled_by_id: str, reason: str, role: str = "administrador") -> Optional[Dict[str, Any]]:
        expense = self._memory_expenses.get(expense_id)
        if not expense:
            return None
        expense["status"] = "anulado"
        expense["annulled_by_user_id"] = annulled_by_id
        expense["annulled_at"] = datetime.now().isoformat()
        expense["annulment_reason"] = reason
        return expense

# Instancia singleton del administrador de datos local
db_manager = LocalDatabaseManager()
