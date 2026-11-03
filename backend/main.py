"""
Sistema POS 90 Grados - Servidor Backend FastAPI
Restaurante-Bar 90 Grados, Cundinamarca, Colombia
Autoridad central de datos para terminales de salón, barra, KDS y aplicaciones móviles.
"""

import os
import sys
from typing import List, Dict, Optional, Any
from datetime import datetime

try:
    from fastapi import FastAPI, HTTPException, status, Query, Body, Header, Depends
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import JSONResponse, PlainTextResponse
    from pydantic import BaseModel, Field
except ImportError:
    # Si FastAPI no está instalado aún en el entorno local de desarrollo,
    # el archivo se preserva sintácticamente válido para cuando se ejecute en el All-in-One.
    pass

from backend.services.cash_calculator import CashDenominations, calcular_pago_efectivo
from backend.services.shift_service import BeverageSKUReconciliation, CashLedgerShift
from backend.services.ledger_service import AsientoContable, MonthlyFinancialReport
from backend.services.commission_service import (
    WaiterSalesSummary,
    calculate_shift_waiter_commissions,
    ShiftCommissionCalculationResult
)
from backend.services.pdf_carta_extractor import (
    parse_carta_from_csv_text,
    generate_revision_csv_template,
    CartaDraftExtractionReport
)
from backend.security.security_config import (
    hash_pin_securely,
    verify_pin_securely,
    RateLimiter,
    sanitize_text,
    validate_order_financials_server_side,
    filter_product_for_role,
    SECURITY_HEADERS
)
from backend.database.db_service import db_manager

# Inicializar aplicación FastAPI
try:
    app = FastAPI(
        title="API POS 90 Grados - Autoridad Local",
        description="Backend local-first para restaurante-bar 90 Grados (Cundinamarca, Colombia)",
        version="1.0.0-piloto"
    )

    # Configuración de CORS para permitir conexiones de Electron (localhost), navegador web y Capacitor (Android LAN)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # En producción LAN, restringido a IPs privadas
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Middleware de headers de seguridad obligatorios
    @app.middleware("http")
    async def add_security_headers_middleware(request, call_next):
        response = await call_next(request)
        for header_key, header_val in SECURITY_HEADERS.items():
            response.headers[header_key] = header_val
        return response

    # Modelos Pydantic para validación estricta de inputs
    class CalculateCashRequest(BaseModel):
        saldo_pendiente: int = Field(..., ge=0)
        bill_10000: int = Field(0, ge=0)
        bill_20000: int = Field(0, ge=0)
        bill_50000: int = Field(0, ge=0)
        bill_100000: int = Field(0, ge=0)
        monto_electronico: int = Field(0, ge=0)

    class CommissionCalculateRequest(BaseModel):
        shift_id: str
        shift_center: str
        shift_status: str
        shift_closed_at: Optional[str] = None
        commission_percentage: float = Field(..., ge=0.0, le=100.0)
        calculated_by_user_id: str
        audit_notes: Optional[str] = ""
        waiters_sales: List[Dict[str, Any]]

    class ExpenseCreateRequest(BaseModel):
        operational_date: str
        amount_cop: int = Field(..., gt=0)
        category: str
        type: str
        description: str
        payment_method: str
        registered_by_user_id: str
        shift_id: Optional[str] = None
        third_party_name: Optional[str] = None
        third_party_nit: Optional[str] = None
        invoice_number: Optional[str] = None
        status: Optional[str] = "aprobado"

    class ExpenseAnnulRequest(BaseModel):
        annulled_by_user_id: str
        annulment_reason: str = Field(..., min_length=5)

    class CsvDraftParseRequest(BaseModel):
        csv_content: str
        filename: Optional[str] = "carta_revision.csv"

    class AuthLoginRequest(BaseModel):
        username: str
        pin: str = Field(..., min_length=4, max_length=6)

    class OrderItemInput(BaseModel):
        product_id: str
        product_name: str
        quantity: int = Field(..., gt=0)
        unit_price_cop: int = Field(..., ge=0)
        station: str = "cocina"
        notes: Optional[str] = ""

    class OrderCreateRequest(BaseModel):
        table_number: str
        waiter_id: str
        waiter_name: str
        items: List[OrderItemInput]
        shift_id: Optional[str] = None
        customer_note: Optional[str] = ""

    class OrderStatusUpdateRequest(BaseModel):
        status: Optional[str] = None
        cocina_status: Optional[str] = None
        bar_status: Optional[str] = None

    class PaymentProcessRequest(BaseModel):
        order_id: str
        total_due_cop: int = Field(..., ge=0)
        received_cash_cop: int = Field(0, ge=0)
        change_given_cop: int = Field(0, ge=0)
        bill_10000: int = Field(0, ge=0)
        bill_20000: int = Field(0, ge=0)
        bill_50000: int = Field(0, ge=0)
        bill_100000: int = Field(0, ge=0)
        payment_methods: List[Dict[str, Any]]
        cashier_id: str
        idempotency_key: str = Field(..., min_length=10)

    class ShiftOpenRequest(BaseModel):
        center: str = "Restaurante Matutino"
        opened_by_id: str
        initial_fund_cop: int = Field(..., ge=0)

    class ShiftCloseRequest(BaseModel):
        shift_id: str
        closed_by_id: str
        counted_cash_cop: int = Field(..., ge=0)
        expected_cash_cop: int = Field(..., ge=0)

    # Endpoints principales

    @app.get("/api/health")
    def health_check():
        return {
            "status": "operativo",
            "service": "90 Grados POS API",
            "version": "1.0.0-piloto",
            "timezone": "America/Bogota",
            "timestamp": datetime.now().isoformat()
        }

    @app.post("/api/cash/calculate")
    def calculate_cash_payment(req: CalculateCashRequest):
        denoms = CashDenominations(
            bill_10000=req.bill_10000,
            bill_20000=req.bill_20000,
            bill_50000=req.bill_50000,
            bill_100000=req.bill_100000
        )
        try:
            res = calcular_pago_efectivo(
                saldo_pendiente=req.saldo_pendiente,
                denominaciones=denoms,
                monto_electronico=req.monto_electronico
            )
            return {
                "efectivo_recibido": res.efectivo_recibido,
                "monto_electronico": res.monto_electronico,
                "total_abonado": res.total_abonado,
                "vuelto_a_entregar": res.vuelto_a_entregar,
                "saldo_restante": res.saldo_restante,
                "es_cuenta_pagada": res.es_cuenta_pagada
            }
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    @app.post("/api/commissions/calculate")
    def calculate_commissions(req: CommissionCalculateRequest):
        waiters = [
            WaiterSalesSummary(
                waiter_id=w["waiter_id"],
                waiter_name=w["waiter_name"],
                orders_count=w.get("orders_count", 0),
                gross_sales_cop=w.get("gross_sales_cop", 0),
                net_sales_cop=w.get("net_sales_cop", 0)
            ) for w in req.waiters_sales
        ]
        try:
            result = calculate_shift_waiter_commissions(
                shift_id=req.shift_id,
                shift_center=req.shift_center,
                shift_status=req.shift_status,
                shift_closed_at=req.shift_closed_at,
                waiters_sales=waiters,
                commission_percentage=req.commission_percentage,
                calculated_by_user_id=req.calculated_by_user_id,
                audit_notes=req.audit_notes or ""
            )
            return {
                "shift_id": result.shift_id,
                "shift_center": result.shift_center,
                "total_waiters_count": result.total_waiters_count,
                "total_sales_base_cop": result.total_sales_base_cop,
                "commission_percentage": result.commission_percentage,
                "total_commission_cop": result.total_commission_cop,
                "waiters_detail": [
                    {
                        "waiter_id": d.waiter_id,
                        "waiter_name": d.waiter_name,
                        "orders_count": d.orders_count,
                        "sales_base_cop": d.sales_base_cop,
                        "commission_percentage": d.commission_percentage,
                        "commission_amount_cop": d.commission_amount_cop,
                        "audit_notes": d.audit_notes
                    } for d in result.waiters_detail
                ]
            }
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    @app.get("/api/carta/csv-template")
    def get_carta_csv_template():
        template = generate_revision_csv_template()
        return PlainTextResponse(template, media_type="text/csv")

    @app.post("/api/carta/import-csv-draft")
    def import_carta_csv_draft(req: CsvDraftParseRequest):
        try:
            reporte = parse_carta_from_csv_text(req.csv_content, filename=req.filename or "carta_subida.csv")
            return reporte.to_dict()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error al procesar el archivo borrador: {str(e)}")

    # =========================================================================
    # ENDPOINTS PERSISTENTES: PEDIDOS / COMANDAS (ORDERS)
    # =========================================================================
    @app.get("/api/orders")
    def list_orders(status: Optional[str] = None, shift_id: Optional[str] = None):
        return db_manager.get_orders(status=status, shift_id=shift_id)

    @app.post("/api/orders")
    def create_order_endpoint(req: OrderCreateRequest):
        order_id = f"ord-{int(datetime.now().timestamp() * 1000)}"
        items_dict = [it.dict() for it in req.items]
        return db_manager.create_order(
            order_id=order_id,
            table_number=req.table_number,
            waiter_id=req.waiter_id,
            waiter_name=req.waiter_name,
            items=items_dict,
            shift_id=req.shift_id,
            customer_note=req.customer_note or "",
            role="mesero"
        )

    @app.patch("/api/orders/{order_id}/status")
    def update_order_status_endpoint(order_id: str, req: OrderStatusUpdateRequest):
        updated = db_manager.update_order_status(
            order_id=order_id,
            status=req.status,
            cocina_status=req.cocina_status,
            bar_status=req.bar_status,
            role="cajero"
        )
        if not updated:
            raise HTTPException(status_code=404, detail="Comanda no encontrada")
        return updated

    # =========================================================================
    # ENDPOINTS PERSISTENTES: PAGOS Y COBROS (PAYMENTS)
    # =========================================================================
    @app.post("/api/payments")
    def process_payment_endpoint(req: PaymentProcessRequest):
        payment_id = f"pay-{int(datetime.now().timestamp() * 1000)}"
        denominations = {
            "bill_10000": req.bill_10000,
            "bill_20000": req.bill_20000,
            "bill_50000": req.bill_50000,
            "bill_100000": req.bill_100000
        }
        res = db_manager.process_payment(
            payment_id=payment_id,
            order_id=req.order_id,
            total_due_cop=req.total_due_cop,
            received_cash_cop=req.received_cash_cop,
            change_given_cop=req.change_given_cop,
            denominations=denominations,
            payment_methods=req.payment_methods,
            cashier_id=req.cashier_id,
            idempotency_key=req.idempotency_key,
            role="cajero"
        )
        return res

    # =========================================================================
    # ENDPOINTS PERSISTENTES: TURNOS DE CAJA (SHIFTS)
    # =========================================================================
    @app.get("/api/shifts/current")
    def get_current_shift_endpoint(center: str = "Restaurante Matutino"):
        shift = db_manager.get_current_shift(center)
        if not shift:
            return {"active": False, "message": "No hay turno activo para este centro"}
        return {"active": True, "shift": shift}

    @app.post("/api/shifts/open")
    def open_shift_endpoint(req: ShiftOpenRequest):
        shift_id = f"shift-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        return db_manager.open_shift(
            shift_id=shift_id,
            center=req.center,
            opened_by_id=req.opened_by_id,
            initial_fund_cop=req.initial_fund_cop,
            role="cajero"
        )

    @app.post("/api/shifts/close")
    def close_shift_endpoint(req: ShiftCloseRequest):
        closed = db_manager.close_shift(
            shift_id=req.shift_id,
            closed_by_id=req.closed_by_id,
            counted_cash_cop=req.counted_cash_cop,
            expected_cash_cop=req.expected_cash_cop,
            role="cajero"
        )
        if not closed:
            raise HTTPException(status_code=404, detail="Turno no encontrado")
        return closed

    # =========================================================================
    # ENDPOINTS PERSISTENTES: GASTOS Y EGRESOS OPERATIVOS (EXPENSES)
    # =========================================================================
    @app.get("/api/expenses")
    def get_expenses_endpoint(operational_date: Optional[str] = None):
        return db_manager.get_expenses(operational_date)

    @app.post("/api/expenses")
    def create_expense_endpoint(req: ExpenseCreateRequest):
        data = req.dict()
        return db_manager.create_expense(data, role="cajero")

    @app.post("/api/expenses/{expense_id}/annul")
    def annul_expense_endpoint(expense_id: str, req: ExpenseAnnulRequest):
        annulled = db_manager.annul_expense(
            expense_id=expense_id,
            annulled_by_id=req.annulled_by_user_id,
            reason=req.annulment_reason,
            role="administrador"
        )
        if not annulled:
            raise HTTPException(status_code=404, detail="Gasto no encontrado")
        return annulled

except NameError:
    # FastAPI no disponible globalmente
    app = None
