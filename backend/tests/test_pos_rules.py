"""
Suite de Pruebas Automatizadas - Sistema POS 90 Grados
Valida Reglas de Negocio, Cálculo de Billetes COP, Cierres X/Z, Auditoría y los 20 Controles de Seguridad
"""

import unittest
from backend.services.cash_calculator import (
    CashDenominations, 
    calcular_pago_efectivo
)
from backend.services.shift_service import (
    BeverageSKUReconciliation, 
    CashLedgerShift
)
from backend.services.ledger_service import (
    AsientoContable, 
    MonthlyFinancialReport
)
from backend.security.security_config import (
    hash_pin_securely,
    verify_pin_securely,
    RateLimiter,
    is_lan_ip,
    sanitize_text,
    validate_uploaded_file,
    validate_order_financials_server_side,
    filter_product_for_role
)

class Test90GradosPOS(unittest.TestCase):

    # ==========================================================================
    # CASOS OBLIGATORIOS DE BILLETES Y VUELTAS EXACTAS (Sección 5 y 12)
    # ==========================================================================
    def test_caso_aceptacion_cuenta_37500(self):
        """
        Caso obligatorio 1:
        Cuenta de $37.500 COP: dos toques a $20.000 generan recibido $40.000 y vuelto exacto de $2.500.
        """
        saldo = 37500
        # Dos toques de $20.000
        billetes = CashDenominations(bill_20000=2)
        resultado = calcular_pago_efectivo(saldo, billetes)

        self.assertEqual(resultado.efectivo_recibido, 40000)
        self.assertEqual(resultado.vuelto_a_entregar, 2500)
        self.assertEqual(resultado.saldo_restante, 0)
        self.assertTrue(resultado.es_cuenta_pagada)

    def test_caso_aceptacion_cuenta_120000(self):
        """
        Caso obligatorio 2:
        Cuenta de $120.000 COP: un toque a $100.000 deja $20.000 pendientes, no marca la cuenta pagada y no muestra vuelto.
        """
        saldo = 120000
        # Un toque de $100.000
        billetes = CashDenominations(bill_100000=1)
        resultado = calcular_pago_efectivo(saldo, billetes)

        self.assertEqual(resultado.efectivo_recibido, 100000)
        self.assertEqual(resultado.vuelto_a_entregar, 0)
        self.assertEqual(resultado.saldo_restante, 20000)
        self.assertFalse(resultado.es_cuenta_pagada)

    def test_pago_mixto_efectivo_y_electronico(self):
        """
        Prueba pago mixto: Cuenta de $80.000 COP, $50.000 por Nequi y un billete de $50.000 en efectivo.
        Vuelto = $20.000 sobre el efectivo frente al remanente ($30.000).
        """
        saldo = 80000
        monto_nequi = 50000
        billetes = CashDenominations(bill_50000=1)  # $50.000
        resultado = calcular_pago_efectivo(saldo, billetes, monto_electronico=monto_nequi)

        self.assertEqual(resultado.efectivo_recibido, 50000)
        self.assertEqual(resultado.total_abonado, 100000)
        self.assertEqual(resultado.vuelto_a_entregar, 20000)
        self.assertEqual(resultado.saldo_restante, 0)
        self.assertTrue(resultado.es_cuenta_pagada)

    def test_caso_obligatorio_cuenta_233000_recibido_300000(self):
        """
        Prueba obligatoria del requerimiento:
        Total de cuenta $233.000 y efectivo recibido $300.000 (ej. 3 billetes de $100.000) -> vuelto $67.000.
        """
        saldo = 233000
        billetes = CashDenominations(bill_100000=3)  # 3 x $100.000 = $300.000 COP
        resultado = calcular_pago_efectivo(saldo, billetes)

        self.assertEqual(resultado.efectivo_recibido, 300000)
        self.assertEqual(resultado.vuelto_a_entregar, 67000)
        self.assertEqual(resultado.saldo_restante, 0)
        self.assertTrue(resultado.es_cuenta_pagada)

    # ==========================================================================
    # CASOS OBLIGATORIOS DE CONCILIACIÓN DE BEBIDAS Y TURNOS (Sección 8)
    # ==========================================================================
    def test_conciliacion_bebidas_por_sku(self):
        """
        Fórmula Sección 8:
        esperado = inicial + entradas + traslados_in - traslados_out - consumo_teórico - mermas
        diferencia = contado - esperado
        """
        recon = BeverageSKUReconciliation(
            sku="CER-001",
            nombre_producto="Cerveza Poker 330ml",
            ubicacion="Bar",
            saldo_inicial=48,
            compras_entradas=24,
            traslados_entrada=12,
            traslados_salida=6,
            consumo_teorico_ventas=30,
            mermas_autorizadas=2,
            conteo_fisico=46
        )
        # Esperado = 48 + 24 + 12 - 6 - 30 - 2 = 46
        self.assertEqual(recon.calcular_esperado(), 46)
        # Conteo físico = 46 -> diferencia = 0 (cuadre perfecto)
        self.assertEqual(recon.calcular_diferencia(), 0)

    def test_caja_libro_esperado(self):
        """
        Calcula el efectivo esperado a partir del libro de caja:
        fondo inicial + efectivo neto recibido + entradas - devoluciones - retiros - propinas
        """
        caja = CashLedgerShift(
            id="shift-001",
            centro="Restaurante Matutino",
            fondo_inicial=200000,
            efectivo_neto_ventas=350000,
            entradas_registradas=50000,
            devoluciones_efectivo=0,
            pagos_retiros_autorizados=100000,
            propinas_pagadas_cajon=20000
        )
        # Esperado = 200.000 + 350.000 + 50.000 - 0 - 100.000 - 20.000 = 480.000
        self.assertEqual(caja.calcular_efectivo_esperado(), 480000)

    # ==========================================================================
    # CASOS OBLIGATORIOS DE LIBRO MAYOR Y SEPARACIÓN DE CAPITAL (Sección 7)
    # ==========================================================================
    def test_asiento_partida_doble_cuadrado(self):
        asiento = AsientoContable(
            id="as-01",
            fecha="2026-10-16",
            concepto="Venta comida rapida",
            cuenta_debito="110505 - Caja General",
            cuenta_credito="414005 - Ingresos Restaurante",
            monto_cop=45000,
            usuario="carmen_gerente",
            tipo_origen="venta"
        )
        self.assertTrue(asiento.esta_cuadrado())

    def test_inversion_no_es_venta_ni_saldo_es_utilidad(self):
        """
        Regla Sección 7:
        No cuentes una inversión o aporte del dueño como ingreso por ventas.
        No presentes saldo de caja como ganancia.
        """
        reporte = MonthlyFinancialReport(
            mes="2026-10",
            ventas_totales_cop=10000000,
            descuentos_anulaciones_cop=200000,
            costo_de_ventas_estimado_cop=3800000,
            gastos_operativos_cop=2500000,
            perdidas_mermas_cop=100000,
            aportes_inversion_dueno_cop=5000000,  # $5M invertidos por el dueño
            retiros_dueno_cop=0
        )
        # Ingresos Netos = 10.000.000 - 200.000 = 9.800.000
        # Egresos = 3.800.000 + 2.500.000 + 100.000 = 6.400.000
        # Resultado Operativo = 9.800.000 - 6.400.000 = 3.400.000
        # LOS 5 MILLONES DEL DUEÑO NO DEBEN ALTERAR EL RESULTADO DE VENTAS
        self.assertEqual(reporte.calcular_resultado_operativo_estimado(), 3400000)

    # ==========================================================================
    # PRUEBAS DE LOS 20 CONTROLES DE SEGURIDAD (Sección 11)
    # ==========================================================================
    def test_control_10_hashear_pin(self):
        """Control 10: PINs hasheados con PBKDF2 y sal criptográfica."""
        pin = "2345"
        h, salt = hash_pin_securely(pin)
        self.assertNotEqual(pin, h)
        self.assertTrue(verify_pin_securely(pin, h, salt))
        self.assertFalse(verify_pin_securely("9999", h, salt))

    def test_control_11_rate_limiting(self):
        """Control 11: Rate limiting tras 5 intentos en ventana de tiempo."""
        limiter = RateLimiter(max_requests=3, window_seconds=10)
        user_ip = "192.168.1.45"
        self.assertFalse(limiter.is_rate_limited(user_ip))
        self.assertFalse(limiter.is_rate_limited(user_ip))
        self.assertFalse(limiter.is_rate_limited(user_ip))
        # El 4to intento debe ser bloqueado por rate limit
        self.assertTrue(limiter.is_rate_limited(user_ip))

    def test_control_12_proteccion_lan(self):
        """Control 12: Admite solo IPs en subred privada de restaurante."""
        self.assertTrue(is_lan_ip("192.168.1.100"))
        self.assertTrue(is_lan_ip("127.0.0.1"))
        self.assertTrue(is_lan_ip("10.0.0.15"))
        # IP pública externa bloqueada
        self.assertFalse(is_lan_ip("186.28.140.22"))
        self.assertFalse(is_lan_ip("8.8.8.8"))

    def test_control_14_15_sanitizacion_xss(self):
        """Control 15: Sanitizar texto y escapar scripts maliciosos en notas."""
        malicious_note = "Sin cebolla <script>alert('xss')</script>"
        clean = sanitize_text(malicious_note)
        self.assertNotIn("<script>", clean)
        self.assertIn("&lt;script&gt;", clean)

    def test_control_16_restringir_archivos_ejecutables(self):
        """Control 16: Bloquea extensiones ejecutables y valida magic bytes."""
        # Archivo ejecutable malicioso
        valido, _ = validate_uploaded_file("malware.exe", b"MZ\x90\x00", "application/x-msdownload")
        self.assertFalse(valido)
        
        # JPEG con magic bytes auténticos
        valid_jpeg_bytes = b'\xff\xd8\xff\xe0\x00\x10JFIF'
        valido_img, _ = validate_uploaded_file("foto_perfil.jpg", valid_jpeg_bytes, "image/jpeg")
        self.assertTrue(valido_img)

    def test_control_8_bloquear_manipulacion_precios_cliente(self):
        """Control 8: El total se recalcula siempre en servidor con precios oficiales."""
        catalogo = {"CAR-001": 45000, "CER-001": 5000}
        
        # Cliente intentando enviar cantidad con precio manipulado a $100 COP
        items_manipulados = [
            {"sku": "CAR-001", "quantity": 1, "client_reported_price": 100},
            {"sku": "CER-001", "quantity": 2, "client_reported_price": 50}
        ]
        total_oficial = validate_order_financials_server_side(items_manipulados, catalogo)
        # El servidor calcula 45.000 + (2 * 5.000) = 55.000 COP, ignorando la manipulación
        self.assertEqual(total_oficial, 55000)

    def test_control_17_devolver_datos_minimos_segun_rol(self):
        """Control 17: Redacción de costos confidenciales para meseros."""
        plato = {
            "name": "Churrasco",
            "price_cop": 45000,
            "estimated_cost_cop": 18500,
            "theoretical_margin_percentage": 58.8
        }
        # Para mesero: costos confidenciales ocultados
        datos_mesero = filter_product_for_role(plato, "mesero")
        self.assertNotIn("estimated_cost_cop", datos_mesero)
        self.assertNotIn("theoretical_margin_percentage", datos_mesero)

        # Para administrador: costos disponibles
        datos_admin = filter_product_for_role(plato, "administrador")
        self.assertIn("estimated_cost_cop", datos_admin)

    # ==========================================================================
    # CASOS DE PERSISTENCIA LOCAL, IDEMPOTENCIA Y FLUJO FINANCIERO
    # ==========================================================================
    def test_flujo_persistencia_comanda_y_pago_idempotente(self):
        """Prueba creación de pedido, total calculado en servidor y pago idempotente."""
        from backend.database.db_service import db_manager

        order_id = "test-ord-5001"
        items = [
            {"product_id": "prd-pic-2", "quantity": 1, "unit_price_cop": 90000, "station": "cocina"},
            {"product_id": "prd-cer-1", "quantity": 2, "unit_price_cop": 5000, "station": "bar"}
        ]
        created = db_manager.create_order(
            order_id=order_id,
            table_number="Mesa 5",
            waiter_id="usr-3",
            waiter_name="Mesero Salón 1",
            items=items,
            shift_id="shift-test-01",
            role="mesero"
        )
        self.assertEqual(created["total_amount_cop"], 100000)
        self.assertEqual(created["status"], "abierta")

        # Pago con clave de idempotencia
        idempotency_key = "idem-key-abc-123-unique"
        payment = db_manager.process_payment(
            payment_id="test-pay-5001",
            order_id=order_id,
            total_due_cop=100000,
            received_cash_cop=100000,
            change_given_cop=0,
            denominations={"bill_50000": 2},
            payment_methods=[{"method": "efectivo_caja", "amount": 100000}],
            cashier_id="usr-2",
            idempotency_key=idempotency_key,
            role="cajero"
        )
        self.assertEqual(payment["total_due_cop"], 100000)

        # Repetición idéntica de la petición con la misma idempotency_key
        duplicate_payment = db_manager.process_payment(
            payment_id="test-pay-5001-duplicate",
            order_id=order_id,
            total_due_cop=100000,
            received_cash_cop=100000,
            change_given_cop=0,
            denominations={"bill_50000": 2},
            payment_methods=[{"method": "efectivo_caja", "amount": 100000}],
            cashier_id="usr-2",
            idempotency_key=idempotency_key,
            role="cajero"
        )
        # Debe retornar el mismo registro original sin duplicar el cobro
        self.assertEqual(duplicate_payment["id"], "test-pay-5001")

        # Comprobar estado de la orden actualizada
        orders = db_manager.get_orders()
        matched = [o for o in orders if o["id"] == order_id]
        self.assertEqual(len(matched), 1)
        self.assertEqual(matched[0]["status"], "pagada")

    def test_flujo_turnos_apertura_y_cierre_z(self):
        """Prueba apertura de turno y cierre Z con arqueo de diferencia."""
        from backend.database.db_service import db_manager

        shift_id = "test-shift-09"
        opened = db_manager.open_shift(
            shift_id=shift_id,
            center="Restaurante Matutino",
            opened_by_id="usr-2",
            initial_fund_cop=200000,
            role="cajero"
        )
        self.assertEqual(opened["status"], "abierto")
        self.assertEqual(opened["initial_fund_cop"], 200000)

        # Cierre Z con sobrante de $5.000 COP
        closed = db_manager.close_shift(
            shift_id=shift_id,
            closed_by_id="usr-2",
            counted_cash_cop=505000,
            expected_cash_cop=500000,
            role="cajero"
        )
        self.assertEqual(closed["status"], "cerrado")
        self.assertEqual(closed["cash_difference_cop"], 5000)

    def test_flujo_gastos_y_anulacion_auditada(self):
        """Prueba registro de gasto y anulación con motivo obligatorio."""
        from backend.database.db_service import db_manager

        expense_data = {
            "id": "test-exp-100",
            "operational_date": "2026-10-16",
            "amount_cop": 85000,
            "category": "Suministros & Aseo",
            "type": "gasto_operativo",
            "description": "Artículos de aseo y desinfección",
            "payment_method": "efectivo_caja",
            "registered_by_user_id": "usr-2",
            "status": "aprobado"
        }
        created = db_manager.create_expense(expense_data, role="cajero")
        self.assertEqual(created["status"], "aprobado")

        annulled = db_manager.annul_expense(
            expense_id="test-exp-100",
            annulled_by_id="usr-1",
            reason="Factura duplicada por proveedor",
            role="administrador"
        )
        self.assertEqual(annulled["status"], "anulado")
        self.assertEqual(annulled["annulment_reason"], "Factura duplicada por proveedor")

if __name__ == '__main__':
    unittest.main()
