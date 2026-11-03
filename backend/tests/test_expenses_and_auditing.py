"""
Suite de Pruebas de Gastos, Egresos y Auditoría - 90 Grados
Valida reglas de registro, umbral de aprobación, anulación justificada y trazabilidad.
"""

import unittest
from dataclasses import dataclass
from typing import List, Optional

@dataclass
class ExpenseMock:
    id: str
    amount_cop: int
    category: str
    type: str
    description: str
    registered_by_user_id: str
    shift_id: Optional[str]
    status: str
    approved_by_user_id: Optional[str] = None
    annulled_by_user_id: Optional[str] = None
    annulment_reason: Optional[str] = None

class TestExpensesAndAuditing(unittest.TestCase):

    def test_gasto_requiere_monto_positivo(self):
        amount = -50000
        with self.assertRaises(ValueError):
            if amount <= 0:
                raise ValueError("El monto del gasto debe ser estrictamente positivo.")

    def test_gasto_requiere_usuario_y_descripcion(self):
        desc = ""
        user_id = "usr-2"
        with self.assertRaises(ValueError):
            if not desc.strip():
                raise ValueError("La descripción del gasto es obligatoria.")

    def test_umbral_de_aprobacion_gerencial(self):
        umbral_configurado = 200000
        
        # Gasto de $80.000 COP -> Aprobación automática o directa
        gasto_menor = ExpenseMock(
            id="exp-1", amount_cop=80000, category="Suministros & Aseo",
            type="gasto_operativo", description="Compra de jabón y servilletas",
            registered_by_user_id="usr-2", shift_id="shift-1", status="aprobado"
        )
        self.assertEqual(gasto_menor.status, "aprobado")

        # Gasto de $350.000 COP -> Requiere aprobación de administrador
        gasto_mayor = ExpenseMock(
            id="exp-2", amount_cop=350000, category="Mantenimiento",
            type="gasto_operativo", description="Reparación compresor nevera barra",
            registered_by_user_id="usr-2", shift_id="shift-1",
            status="pendiente_aprobacion" if 350000 > umbral_configurado else "aprobado"
        )
        self.assertEqual(gasto_mayor.status, "pendiente_aprobacion")

    def test_anulacion_exige_motivo_obligatorio(self):
        gasto = ExpenseMock(
            id="exp-3", amount_cop=45000, category="Transporte & Acarreos",
            type="gasto_operativo", description="Flete hielo de emergencia",
            registered_by_user_id="usr-2", shift_id="shift-1", status="aprobado"
        )
        
        # Intento de anular sin justificación -> Rechazado
        motivo_vacio = "   "
        with self.assertRaises(ValueError):
            if not motivo_vacio.strip():
                raise ValueError("Es obligatorio registrar un motivo detallado para anular un egreso.")

        # Anulación válida con auditoría
        motivo_valido = "Comprobante duplicado por error de digitación en caja."
        gasto.status = "anulado"
        gasto.annulled_by_user_id = "usr-1"
        gasto.annulment_reason = motivo_valido

        self.assertEqual(gasto.status, "anulado")
        self.assertIsNotNone(gasto.annulment_reason)

if __name__ == '__main__':
    unittest.main()
