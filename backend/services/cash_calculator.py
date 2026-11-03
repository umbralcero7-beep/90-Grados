"""
Sistema de Punto de Venta (POS) y Gestión Operativa - 90 Grados
Servicio de Cálculo Financiero y Reglas de Negocio en Efectivo (Sección 5)
Restaurante-Bar 90 Grados, Cundinamarca, Colombia
Usa exclusivamente biblioteca estándar de Python (dataclasses) para máxima portabilidad local.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional

@dataclass
class CashDenominations:
    bill_10000: int = 0  # Billetes de $10.000 COP
    bill_20000: int = 0  # Billetes de $20.000 COP
    bill_50000: int = 0  # Billetes de $50.000 COP
    bill_100000: int = 0 # Billetes de $100.000 COP

    def total_cash(self) -> int:
        """Calcula el total exacto de efectivo recibido utilizando enteros en COP."""
        return (
            (self.bill_10000 * 10000) +
            (self.bill_20000 * 20000) +
            (self.bill_50000 * 50000) +
            (self.bill_100000 * 100000)
        )

@dataclass
class PaymentCalculationResult:
    saldo_pendiente_original: int
    efectivo_recibido: int
    monto_electronico: int
    total_abonado: int
    vuelto_a_entregar: int
    saldo_restante: int
    es_cuenta_pagada: bool

def calcular_pago_efectivo(
    saldo_pendiente: int,
    denominaciones: CashDenominations,
    monto_electronico: int = 0
) -> PaymentCalculationResult:
    """
    Fórmulas obligatorias (Sección 5 del requerimiento):
    vuelto = max(efectivo_recibido - saldo_pendiente_para_efectivo, 0)
    saldo_pendiente_nuevo = max(saldo_pendiente - efectivo_recibido, 0)
    
    Cálculo estricto con enteros en COP (pesos colombianos).
    """
    if saldo_pendiente < 0:
        raise ValueError("El saldo pendiente no puede ser negativo")
    if monto_electronico < 0:
        raise ValueError("El monto electrónico no puede ser negativo")
    
    efectivo_recibido = denominaciones.total_cash()
    
    # Si hay pago electrónico mixto, el efectivo solo cubre el remanente
    saldo_para_efectivo = max(saldo_pendiente - monto_electronico, 0)
    
    vuelto = max(efectivo_recibido - saldo_para_efectivo, 0)
    
    # Saldo aún pendiente si el abono total no alcanza
    total_abonado = efectivo_recibido + monto_electronico
    saldo_restante = max(saldo_pendiente - total_abonado, 0)
    
    es_pagada = (saldo_restante == 0) and (total_abonado >= saldo_pendiente)
    
    return PaymentCalculationResult(
        saldo_pendiente_original=saldo_pendiente,
        efectivo_recibido=efectivo_recibido,
        monto_electronico=monto_electronico,
        total_abonado=total_abonado,
        vuelto_a_entregar=vuelto,
        saldo_restante=saldo_restante,
        es_cuenta_pagada=es_pagada
    )
