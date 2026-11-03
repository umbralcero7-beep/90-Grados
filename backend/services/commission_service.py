"""
Sistema de Punto de Venta (POS) - 90 Grados
Servicio de Cálculo de Comisiones para Meseros (Sección Personal & Cierres)
Restaurante-Bar 90 Grados, Cundinamarca, Colombia

Regla estricta: La comisión por mesero se calcula ÚNICAMENTE después del cierre de turno,
utilizando un porcentaje configurable por el Administrador. No se inventa ningún porcentaje por defecto.
"""

from dataclasses import dataclass
from typing import List, Dict, Optional, Any
from datetime import datetime

@dataclass
class WaiterSalesSummary:
    waiter_id: str
    waiter_name: str
    orders_count: int
    gross_sales_cop: int
    net_sales_cop: int  # Ventas menos anulaciones/descuentos

@dataclass
class WaiterCommissionDetail:
    waiter_id: str
    waiter_name: str
    orders_count: int
    sales_base_cop: int
    commission_percentage: float
    commission_amount_cop: int
    calculated_at: str
    calculated_by_user_id: str
    shift_id: str
    audit_notes: str

@dataclass
class ShiftCommissionCalculationResult:
    shift_id: str
    shift_center: str
    shift_closed_at: str
    total_waiters_count: int
    total_sales_base_cop: int
    commission_percentage: float
    total_commission_cop: int
    waiters_detail: List[WaiterCommissionDetail]
    is_audited: bool


def calculate_shift_waiter_commissions(
    shift_id: str,
    shift_center: str,
    shift_status: str,
    shift_closed_at: Optional[str],
    waiters_sales: List[WaiterSalesSummary],
    commission_percentage: float,
    calculated_by_user_id: str,
    audit_notes: str = ""
) -> ShiftCommissionCalculationResult:
    """
    Calcula comisiones para meseros tras el cierre del turno.
    
    Reglas obligatorias:
    1. El turno DEBE estar en estado 'cerrado'. No se permite liquidar comisiones en turnos abiertos.
    2. El porcentaje de comisión debe ser mayor o igual a 0.0% y menor o igual a 100.0%.
    3. El cálculo es auditable por mesero con base en ventas atribuibles verificadas.
    4. El monto en COP se redondea al entero más próximo (sin decimales en COP).
    """
    if shift_status != "cerrado":
        raise ValueError(
            f"Operación bloqueada: El turno '{shift_id}' se encuentra en estado '{shift_status}'. "
            "Las comisiones de meseros solo pueden calcularse sobre turnos debidamente cerrados (Corte Z)."
        )

    if commission_percentage < 0.0 or commission_percentage > 100.0:
        raise ValueError(
            f"Porcentaje de comisión inválido ({commission_percentage}%). "
            "Debe ser un valor configurable entre 0.0% y 100.0% definido por la administración."
        )

    now_iso = datetime.now().isoformat()
    total_sales_base = 0
    total_commission = 0
    details: List[WaiterCommissionDetail] = []

    for w in waiters_sales:
        if w.net_sales_cop < 0:
            raise ValueError(f"Las ventas netas del mesero {w.waiter_name} no pueden ser negativas.")

        sales_base = w.net_sales_cop
        commission_cop = round(sales_base * (commission_percentage / 100.0))

        detail = WaiterCommissionDetail(
            waiter_id=w.waiter_id,
            waiter_name=w.waiter_name,
            orders_count=w.orders_count,
            sales_base_cop=sales_base,
            commission_percentage=commission_percentage,
            commission_amount_cop=commission_cop,
            calculated_at=now_iso,
            calculated_by_user_id=calculated_by_user_id,
            shift_id=shift_id,
            audit_notes=audit_notes or f"Liquidación post-cierre {commission_percentage}% sobre ventas netas."
        )
        details.append(detail)
        total_sales_base += sales_base
        total_commission += commission_cop

    return ShiftCommissionCalculationResult(
        shift_id=shift_id,
        shift_center=shift_center,
        shift_closed_at=shift_closed_at or now_iso,
        total_waiters_count=len(details),
        total_sales_base_cop=total_sales_base,
        commission_percentage=commission_percentage,
        total_commission_cop=total_commission,
        waiters_detail=details,
        is_audited=True
    )
