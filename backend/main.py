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

except NameError:
    # FastAPI no disponible globalmente
    app = None
