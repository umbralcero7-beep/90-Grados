// ==============================================================================
// Widget Obligatorio - Sección 5: Billetes en Efectivo y Vueltas Exactas en COP
// 90 Grados POS Flutter
// ==============================================================================

import 'dart:math';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

class ColombianCashPad extends StatefulWidget {
  final int totalDueCOP;
  final Function(int received, int change, Map<int, int> denominations) onConfirmPayment;
  final VoidCallback onCancel;

  const ColombianCashPad({
    Key? key,
    required this.totalDueCOP,
    required this.onConfirmPayment,
    required this.onCancel,
  }) : super(key: key);

  @override
  State<ColombianCashPad> createState() => _ColombianCashPadState();
}

class _ColombianCashPadState extends State<ColombianCashPad> {
  // Mapa de billetes seleccionados (ÚNICAS 4 DENOMINACIONES PERMITIDAS)
  final Map<int, int> _billCounts = {
    10000: 0,
    20000: 0,
    50000: 0,
    100000: 0,
  };

  final NumberFormat _copFormatter = NumberFormat.currency(
    locale: 'es_CO',
    symbol: '\$',
    decimalDigits: 0,
  );

  int get _cashReceived {
    return (_billCounts[10000]! * 10000) +
           (_billCounts[20000]! * 20000) +
           (_billCounts[50000]! * 50000) +
           (_billCounts[100000]! * 100000);
  }

  // Fórmulas de la Sección 5:
  // vuelto = max(efectivo_recibido - saldo_pendiente, 0)
  // saldo_pendiente_nuevo = max(saldo_pendiente - efectivo_recibido, 0)
  int get _changeToGive => max(_cashReceived - widget.totalDueCOP, 0);
  int get _remainingBalance => max(widget.totalDueCOP - _cashReceived, 0);
  bool get _isCovered => _remainingBalance == 0 && _cashReceived >= widget.totalDueCOP;

  void _addBill(int denom) {
    setState(() {
      _billCounts[denom] = (_billCounts[denom] ?? 0) + 1;
    });
  }

  void _removeBill(int denom) {
    setState(() {
      if ((_billCounts[denom] ?? 0) > 0) {
        _billCounts[denom] = _billCounts[denom]! - 1;
      }
    });
  }

  void _reset() {
    setState(() {
      _billCounts.updateAll((key, value) => 0);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Indicadores de Saldo Pendiente y Vuelto
        Row(
          children: [
            Expanded(
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF141211),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFF292524)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('TOTAL A PAGAR', style: TextStyle(color: Colors.white54, fontSize: 10, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 4),
                    Text(
                      _copFormatter.format(widget.totalDueCOP),
                      style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w900),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: _isCovered ? const Color(0xFF052E16) : const Color(0xFF2D1807),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: _isCovered ? Colors.green : Colors.orange),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _isCovered ? 'VUELTO A ENTREGAR' : 'SALDO RESTANTE',
                      style: TextStyle(
                        color: _isCovered ? Colors.greenAccent : Colors.orangeAccent,
                        fontSize: 10,
                        fontWeight: FontWeight.bold
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _copFormatter.format(_isCovered ? _changeToGive : _remainingBalance),
                      style: TextStyle(
                        color: _isCovered ? Colors.greenAccent : Colors.orangeAccent,
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),

        const SizedBox(height: 12),

        // 4 Botones Rápidos de Billetes Colombianos
        Row(
          children: [
            _buildBillButton(10000, Colors.redAccent),
            const SizedBox(width: 6),
            _buildBillButton(20000, Colors.blueAccent),
            const SizedBox(width: 6),
            _buildBillButton(50000, Colors.purpleAccent),
            const SizedBox(width: 6),
            _buildBillButton(100000, Colors.tealAccent),
          ],
        ),

        const SizedBox(height: 12),

        // Botón de confirmación o alerta de saldo insuficiente
        ElevatedButton(
          onPressed: _isCovered 
            ? () => widget.onConfirmPayment(_cashReceived, _changeToGive, _billCounts)
            : null,
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFFF59E0B),
            foregroundColor: const Color(0xFF0C0A09),
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
          child: Text(
            _isCovered 
              ? 'Confirmar Pago (${_copFormatter.format(widget.totalDueCOP)})'
              : 'Efectivo Insuficiente (Faltan ${_copFormatter.format(_remainingBalance)})',
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
          ),
        ),
      ],
    );
  }

  Widget _buildBillButton(int denom, Color accentColor) {
    final count = _billCounts[denom] ?? 0;
    return Expanded(
      child: InkWell(
        onTap: () => _addBill(denom),
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: const Color(0xFF141211),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: count > 0 ? accentColor : const Color(0xFF292524)),
          ),
          child: Column(
            children: [
              Text(
                _copFormatter.format(denom),
                style: TextStyle(color: accentColor, fontWeight: FontWeight.w900, fontSize: 13),
              ),
              const SizedBox(height: 2),
              Text(
                count > 0 ? '$count un.' : '+1 toque',
                style: const TextStyle(color: Colors.white54, fontSize: 10),
              ),
              if (count > 0)
                GestureDetector(
                  onTap: () => _removeBill(denom),
                  child: const Padding(
                    padding: EdgeInsets.only(top: 4),
                    child: Text('-1', style: TextStyle(color: Colors.redAccent, fontSize: 11, fontWeight: FontWeight.bold)),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
