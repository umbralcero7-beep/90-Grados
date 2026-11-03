// ==============================================================================
// Pantalla del Mesero - Selección de Mesas y Toma de Pedidos (Sección 4)
// Sin botones de cobro, exclusivo para atención en salón y terraza
// 90 Grados POS Flutter
// ==============================================================================

import 'package:flutter/material.dart';
import '../../domain/models/models.dart';

enum TableStatus { libre, ocupada, enPreparacion, lista, pendienteCobro }

class WaiterTablesScreen extends StatefulWidget {
  final UserProfile currentWaiter;
  final Function(String tableNumber) onOpenTableOrder;

  const WaiterTablesScreen({
    Key? key,
    required this.currentWaiter,
    required this.onOpenTableOrder,
  }) : super(key: key);

  @override
  State<WaiterTablesScreen> createState() => _WaiterTablesScreenState();
}

class _WaiterTablesScreenState extends State<WaiterTablesScreen> {
  final List<Map<String, dynamic>> _tables = [
    {'name': 'Mesa 1', 'status': TableStatus.libre, 'zone': 'Salón Principal'},
    {'name': 'Mesa 2', 'status': TableStatus.ocupada, 'zone': 'Salón Principal'},
    {'name': 'Mesa 3', 'status': TableStatus.enPreparacion, 'zone': 'Salón Principal'},
    {'name': 'Mesa 4', 'status': TableStatus.pendienteCobro, 'zone': 'Salón Principal'},
    {'name': 'Terraza 1', 'status': TableStatus.libre, 'zone': 'Terraza Exterior'},
    {'name': 'Terraza 2', 'status': TableStatus.lista, 'zone': 'Terraza Exterior'},
    {'name': 'Barra 1', 'status': TableStatus.libre, 'zone': 'Zona Bar'},
    {'name': 'Barra 2', 'status': TableStatus.ocupada, 'zone': 'Zona Bar'},
    {'name': 'Para Llevar', 'status': TableStatus.libre, 'zone': 'Despacho'},
  ];

  Color _getStatusColor(TableStatus status) {
    switch (status) {
      case TableStatus.libre: return const Color(0xFF16A34A);
      case TableStatus.ocupada: return const Color(0xFF2563EB);
      case TableStatus.enPreparacion: return const Color(0xFFD97706);
      case TableStatus.lista: return const Color(0xFF10B981);
      case TableStatus.pendienteCobro: return const Color(0xFFDC2626);
    }
  }

  String _getStatusLabel(TableStatus status) {
    switch (status) {
      case TableStatus.libre: return 'Libre';
      case TableStatus.ocupada: return 'Ocupada';
      case TableStatus.enPreparacion: return 'En Preparación';
      case TableStatus.lista: return 'Platos Listos';
      case TableStatus.pendienteCobro: return 'Pendiente Cobro';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0C0A09),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1C1917),
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Mesas & Pedidos del Salón', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            Text(
              'Mesero en turno: @${widget.currentWaiter.username} (${widget.currentWaiter.fullName})',
              style: const TextStyle(fontSize: 11, color: Colors.amber),
            ),
          ],
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: GridView.builder(
          gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
            maxCrossAxisExtent: 220,
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 1.1,
          ),
          itemCount: _tables.length,
          itemBuilder: (context, index) {
            final table = _tables[index];
            final status = table['status'] as TableStatus;
            final color = _getStatusColor(status);

            return InkWell(
              onTap: () => widget.onOpenTableOrder(table['name']),
              borderRadius: BorderRadius.circular(16),
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF1C1917),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: color.withOpacity(0.5), width: 1.5),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.between,
                      children: [
                        Text(
                          table['name'],
                          style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w900),
                        ),
                        Container(
                          width: 10,
                          height: 10,
                          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                        ),
                      ],
                    ),
                    Text(
                      table['zone'],
                      style: const TextStyle(color: Colors.white38, fontSize: 11),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: color.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        _getStatusLabel(status),
                        style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
