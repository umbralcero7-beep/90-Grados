// ==============================================================================
// Pantalla Principal POS - Punto de Venta 90 Grados Flutter
// Catálogo Desplazable con Panel de Cobro Fijo (Sección 4)
// ==============================================================================

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../domain/models/models.dart';
import '../widgets/pos_catalog_scroll_layout.dart';
import '../widgets/colombian_cash_pad.dart';

class POSScreen extends StatefulWidget {
  final UserProfile currentUser;
  final String activeTable;

  const POSScreen({
    Key? key,
    required this.currentUser,
    required this.activeTable,
  }) : super(key: key);

  @override
  State<POSScreen> createState() => _POSScreenState();
}

class _POSScreenState extends State<POSScreen> {
  // Controlador de scroll independiente del catálogo
  final ScrollController _catalogScrollController = ScrollController();
  
  String _selectedCategory = 'Todas';
  final List<OrderItem> _currentTicket = [];

  final NumberFormat _copFormatter = NumberFormat.currency(
    locale: 'es_CO',
    symbol: '\$',
    decimalDigits: 0,
  );

  final List<Product> _catalog = const [
    Product(id: '1', sku: 'CR-001', name: 'Salchipapa sencilla', category: 'Comidas Rápidas', priceCOP: 16000, station: Station.cocina, unit: 'porción'),
    Product(id: '2', sku: 'CR-002', name: 'Salchipapa especial', category: 'Comidas Rápidas', priceCOP: 22000, station: Station.cocina, unit: 'porción'),
    Product(id: '3', sku: 'CR-003', name: 'Alitas BBQ (4 un.)', category: 'Comidas Rápidas', priceCOP: 20000, station: Station.cocina, unit: 'porción'),
    Product(id: '4', sku: 'PIC-001', name: 'Picada para 2 personas', category: 'Picadas', priceCOP: 80000, station: Station.cocina, unit: 'plato'),
    Product(id: '5', sku: 'PIC-002', name: 'Picada para 3 personas', category: 'Picadas', priceCOP: 90000, station: Station.cocina, unit: 'plato'),
    Product(id: '6', sku: 'CAR-001', name: 'Parrillada de la casa', category: 'Carnes', priceCOP: 45000, station: Station.cocina, unit: 'plato'),
    Product(id: '7', sku: 'CAR-003', name: 'Churrasco al Carbón', category: 'Carnes', priceCOP: 45000, station: Station.cocina, unit: 'plato'),
    Product(id: '8', sku: 'CER-001', name: 'Cerveza Poker 330ml', category: 'Cervezas', priceCOP: 5000, station: Station.bar, unit: 'botella'),
    Product(id: '9', sku: 'CER-004', name: 'Club Colombia Dorada', category: 'Cervezas', priceCOP: 6000, station: Station.bar, unit: 'botella'),
    Product(id: '10', sku: 'LIC-001', name: 'Botella Antioqueño Verde', category: 'Licores', priceCOP: 110000, station: Station.bar, unit: 'botella'),
  ];

  int get _ticketTotal => _currentTicket.fold(0, (sum, item) => sum + item.subtotal);

  void _addItem(Product product) {
    setState(() {
      final index = _currentTicket.indexWhere((i) => i.productId == product.id);
      if (index >= 0) {
        _currentTicket[index].quantity += 1;
      } else {
        _currentTicket.add(OrderItem(
          productId: product.id,
          productName: product.name,
          unitPriceCOP: product.priceCOP,
          quantity: 1,
          station: product.station,
        ));
      }
    });
  }

  @override
  void dispose() {
    _catalogScrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0C0A09),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1C1917),
        elevation: 0,
        title: Text('${widget.activeTable} - Punto de Venta', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
      ),
      body: POSCatalogScrollLayout(
        catalogScrollController: _catalogScrollController,
        
        // REGIÓN 1: CATÁLOGO DESPLAZABLE (Scroll vertical independiente)
        catalogArea: ListView(
          controller: _catalogScrollController,
          padding: const EdgeInsets.all(16),
          children: [
            // Filtros de Categorías
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: ['Todas', 'Comidas Rápidas', 'Picadas', 'Carnes', 'Cervezas', 'Licores'].map((cat) {
                  final active = _selectedCategory == cat;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8.0),
                    child: ChoiceChip(
                      label: Text(cat),
                      selected: active,
                      onSelected: (_) => setState(() => _selectedCategory = cat),
                      selectedColor: const Color(0xFFF59E0B),
                      backgroundColor: const Color(0xFF1C1917),
                      labelStyle: TextStyle(
                        color: active ? const Color(0xFF0C0A09) : Colors.white70,
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),

            const SizedBox(height: 16),

            // Grid de Productos
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(), // Scroll gestionado por el ListView padre
              gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                maxCrossAxisExtent: 200,
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                childAspectRatio: 1.1,
              ),
              itemCount: _catalog.length,
              itemBuilder: (context, index) {
                final prod = _catalog[index];
                return InkWell(
                  onTap: () => _addItem(prod),
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1C1917),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFF292524)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          prod.name,
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                          maxLines: 2,
                        ),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.between,
                          children: [
                            Text(
                              _copFormatter.format(prod.priceCOP),
                              style: const TextStyle(color: Color(0xFFF59E0B), fontWeight: FontWeight.w900, fontSize: 13),
                            ),
                            Container(
                              padding: const EdgeInsets.all(4),
                              decoration: const BoxDecoration(
                                color: Color(0xFF292524),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.add, color: Colors.white, size: 14),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ],
        ),

        // REGIÓN 2: PANEL DE COBRO Y RESUMEN FIJO (No se desplaza con el catálogo)
        paymentPanel: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.between,
                children: [
                  const Text('RESUMEN DE CUENTA', style: TextStyle(color: Colors.white54, fontSize: 11, fontWeight: FontWeight.bold)),
                  Text('${_currentTicket.length} ítems', style: const TextStyle(color: Colors.amber, fontSize: 11)),
                ],
              ),
              const Divider(color: Color(0xFF292524), height: 20),

              // Lista de ítems en comanda
              Expanded(
                child: _currentTicket.isEmpty
                  ? const Center(child: Text('Comanda vacía', style: TextStyle(color: Colors.white30, fontSize: 12)))
                  : ListView.builder(
                      itemCount: _currentTicket.length,
                      itemBuilder: (context, idx) {
                        final it = _currentTicket[idx];
                        return Padding(
                          padding: const EdgeInsets.symmetric(vertical: 4.0),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.between,
                            children: [
                              Expanded(
                                child: Text(
                                  '${it.quantity}x ${it.productName}',
                                  style: const TextStyle(color: Colors.white, fontSize: 12),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              Text(
                                _copFormatter.format(it.subtotal),
                                style: const TextStyle(color: Colors.amber, fontSize: 12, fontWeight: FontWeight.bold),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
              ),

              const Divider(color: Color(0xFF292524), height: 20),

              // Módulo de cobro en efectivo con los 4 billetes obligatorios
              if (_currentTicket.isNotEmpty)
                ColombianCashPad(
                  totalDueCOP: _ticketTotal,
                  onConfirmPayment: (received, change, denoms) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Pago completado: ${_copFormatter.format(_ticketTotal)}. Vuelto: ${_copFormatter.format(change)}')),
                    );
                    setState(() => _currentTicket.clear());
                  },
                  onCancel: () => setState(() => _currentTicket.clear()),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
