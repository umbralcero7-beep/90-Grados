"""
Sistema de Punto de Venta (POS) - 90 Grados
Servicio de Turnos, Arqueo de Caja y Conciliación de Bebidas (Sección 8)
"""

from dataclasses import dataclass
from typing import List, Dict, Optional
from datetime import datetime

@dataclass
class BeverageSKUReconciliation:
    sku: str
    nombre_producto: str
    ubicacion: str  # 'Bodega', 'Restaurante', 'Bar'
    saldo_inicial: int
    compras_entradas: int = 0
    traslados_entrada: int = 0
    traslados_salida: int = 0
    consumo_teorico_ventas: int = 0
    mermas_autorizadas: int = 0
    conteo_fisico: int = 0

    def calcular_esperado(self) -> int:
        """
        Fórmula Sección 8:
        esperado = inicial + entradas + traslados_entrada - traslados_salida - consumo_teórico - mermas/consumos_autorizados
        """
        return (
            self.saldo_inicial +
            self.compras_entradas +
            self.traslados_entrada -
            self.traslados_salida -
            self.consumo_teorico_ventas -
            self.mermas_autorizadas
        )

    def calcular_diferencia(self) -> int:
        """
        Fórmula Sección 8:
        diferencia = contado - esperado
        """
        return self.conteo_fisico - self.calcular_esperado()

@dataclass
class CashLedgerShift:
    id: str
    centro: str  # 'Restaurante Matutino' o 'Bar Nocturno'
    fondo_inicial: int  # Saldo de caja inicial (NO ingreso de venta)
    efectivo_neto_ventas: int = 0  # Efectivo recibido menos vuelto entregado
    entradas_registradas: int = 0
    devoluciones_efectivo: int = 0
    pagos_retiros_autorizados: int = 0
    propinas_pagadas_cajon: int = 0

    def calcular_efectivo_esperado(self) -> int:
        """
        Fórmula Sección 8:
        efectivo_esperado = fondo_inicial + efectivo_neto_recibido + entradas_registradas
                           - devoluciones_en_efectivo - pagos/retiros_autorizados - propinas_pagadas
        """
        return (
            self.fondo_inicial +
            self.efectivo_neto_ventas +
            self.entradas_registradas -
            self.devoluciones_efectivo -
            self.pagos_retiros_autorizados -
            self.propinas_pagadas_cajon
        )

    def calcular_diferencia_cierre(self, efectivo_contado: int) -> int:
        """Sobrante (+) o Faltante (-)"""
        return efectivo_contado - self.calcular_efectivo_esperado()
