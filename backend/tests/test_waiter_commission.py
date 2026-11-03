"""
Suite de Pruebas de Comisiones de Meseros - 90 Grados
Valida que la comisión se calcule únicamente post-cierre y con porcentaje configurable.
"""

import unittest
from backend.services.commission_service import (
    WaiterSalesSummary,
    calculate_shift_waiter_commissions
)

class TestWaiterCommission(unittest.TestCase):

    def setUp(self):
        self.waiters_sales = [
            WaiterSalesSummary(
                waiter_id="usr-3",
                waiter_name="Mateo Alejandro Silva",
                orders_count=18,
                gross_sales_cop=1200000,
                net_sales_cop=1200000
            ),
            WaiterSalesSummary(
                waiter_id="usr-7",
                waiter_name="Julian Camilo Gomez",
                orders_count=12,
                gross_sales_cop=850000,
                net_sales_cop=800000  # $50.000 en anulaciones descontadas
            )
        ]

    def test_bloqueo_calculo_en_turno_abierto(self):
        """Regla estricta: No se liquidan comisiones en turnos abiertos."""
        with self.assertRaises(ValueError) as ctx:
            calculate_shift_waiter_commissions(
                shift_id="shift-open-01",
                shift_center="Restaurante Matutino",
                shift_status="abierto",  # TURNO NO CERRADO
                shift_closed_at=None,
                waiters_sales=self.waiters_sales,
                commission_percentage=5.0,
                calculated_by_user_id="usr-1"
            )
        self.assertIn("Operación bloqueada", str(ctx.exception))

    def test_calculo_post_cierre_con_porcentaje_configurable_5_por_ciento(self):
        """Liquidación post-cierre con 5.0%."""
        resultado = calculate_shift_waiter_commissions(
            shift_id="shift-closed-01",
            shift_center="Restaurante Matutino",
            shift_status="cerrado",
            shift_closed_at="2026-10-27T16:00:00Z",
            waiters_sales=self.waiters_sales,
            commission_percentage=5.0,  # 5%
            calculated_by_user_id="usr-1",
            audit_notes="Cierre dominical almuerzo"
        )

        self.assertEqual(resultado.total_waiters_count, 2)
        self.assertEqual(resultado.total_sales_base_cop, 2000000)  # 1.2M + 0.8M
        self.assertEqual(resultado.commission_percentage, 5.0)
        self.assertEqual(resultado.total_commission_cop, 100000)   # 5% de 2.000.000

        # Detalle individual
        mateo = resultado.waiters_detail[0]
        self.assertEqual(mateo.waiter_id, "usr-3")
        self.assertEqual(mateo.commission_amount_cop, 60000)  # 5% de 1.200.000

        julian = resultado.waiters_detail[1]
        self.assertEqual(julian.waiter_id, "usr-7")
        self.assertEqual(julian.commission_amount_cop, 40000)  # 5% de 800.000

    def test_calculo_post_cierre_con_porcentaje_arbitrario_3_5_por_ciento(self):
        """Prueba con otro porcentaje configurable (3.5%) sin inventar valores fijos."""
        resultado = calculate_shift_waiter_commissions(
            shift_id="shift-closed-02",
            shift_center="Bar Nocturno",
            shift_status="cerrado",
            shift_closed_at="2026-10-28T03:00:00Z",
            waiters_sales=self.waiters_sales,
            commission_percentage=3.5,
            calculated_by_user_id="usr-1"
        )
        # 1.200.000 * 3.5% = 42.000
        # 800.000 * 3.5% = 28.000
        self.assertEqual(resultado.waiters_detail[0].commission_amount_cop, 42000)
        self.assertEqual(resultado.waiters_detail[1].commission_amount_cop, 28000)
        self.assertEqual(resultado.total_commission_cop, 70000)

    def test_rechazo_de_porcentaje_invalido(self):
        """Porcentajes negativos o superiores a 100 deben ser rechazados."""
        with self.assertRaises(ValueError):
            calculate_shift_waiter_commissions(
                shift_id="shift-closed-03",
                shift_center="Bar Nocturno",
                shift_status="cerrado",
                shift_closed_at="2026-10-28T03:00:00Z",
                waiters_sales=self.waiters_sales,
                commission_percentage=-2.0,  # Negativo
                calculated_by_user_id="usr-1"
            )

if __name__ == '__main__':
    unittest.main()
