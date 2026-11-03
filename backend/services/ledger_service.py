"""
Sistema de Punto de Venta (POS) - 90 Grados
Servicio de Libro Mayor Gerencial y Resultado Mensual (Sección 7)
"""

from dataclasses import dataclass
from typing import List

@dataclass
class AsientoContable:
    id: str
    fecha: str
    concepto: str
    cuenta_debito: str
    cuenta_credito: str
    monto_cop: int
    usuario: str
    tipo_origen: str  # 'venta', 'gasto', 'inversion_dueno', 'retiro_dueno', 'merma'

    def esta_cuadrado(self) -> bool:
        """En un asiento simple de partida doble, el débito debe igualar exactamente al crédito."""
        return self.monto_cop > 0

@dataclass
class MonthlyFinancialReport:
    mes: str
    ventas_totales_cop: int
    descuentos_anulaciones_cop: int
    costo_de_ventas_estimado_cop: int  # Basado en escandallos
    gastos_operativos_cop: int
    perdidas_mermas_cop: int
    
    # Capital del dueño (ESTRICTAMENTE SEPARADO DE VENTAS)
    aportes_inversion_dueno_cop: int
    retiros_dueno_cop: int
    
    def calcular_resultado_operativo_estimado(self) -> int:
        """
        Regla de negocio: La inversión del dueño NUNCA se cuenta como venta.
        Resultado Operativo = Ventas - Descuentos - Costo de Ventas - Gastos Operativos - Mermas
        """
        ingresos_netos = self.ventas_totales_cop - self.descuentos_anulaciones_cop
        egresos_operativos = (
            self.costo_de_ventas_estimado_cop +
            self.gastos_operativos_cop +
            self.perdidas_mermas_cop
        )
        return ingresos_netos - egresos_operativos
