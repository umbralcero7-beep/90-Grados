// ==============================================================================
// Widget Obligatorio - Sección 4: Catálogo Desplazable y Cobro Fijo
// 90 Grados POS Flutter
// ==============================================================================

import 'package:flutter/material.dart';

class POSCatalogScrollLayout extends StatelessWidget {
  /// Widget que contiene la barra de categorías, buscador y el grid desplazable de platos.
  final Widget catalogArea;

  /// Widget que contiene el resumen de cuenta y módulo de pago fijo.
  final Widget paymentPanel;

  /// Controlador de scroll independiente exclusivo del catálogo.
  final ScrollController catalogScrollController;

  const POSCatalogScrollLayout({
    Key? key,
    required this.catalogArea,
    required this.paymentPanel,
    required this.catalogScrollController,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        // En pantallas anchas (>= 900px, tablets horizontales y escritorio)
        // Disposición Lado a Lado con catálogo flexible desplazable y panel de cobro fijo.
        if (constraints.maxWidth >= 900) {
          return Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Región 1: Catálogo con su propio scroll vertical independiente
              Expanded(
                flex: 7,
                child: Scrollbar(
                  controller: catalogScrollController,
                  thumbVisibility: true,
                  child: catalogArea,
                ),
              ),

              // Separador visual fino
              const VerticalDivider(
                width: 1, 
                thickness: 1, 
                color: Color(0xFF292524)
              ),

              // Región 2: Panel de cobro / resumen de cuenta ANCLADO Y FIJO
              // Permanece visible y estático mientras el usuario desplaza los platos a la izquierda
              SizedBox(
                width: 380,
                child: Container(
                  color: const Color(0xFF0C0A09),
                  child: paymentPanel,
                ),
              ),
            ],
          );
        }

        // En pantallas móviles / estrechas (< 900px)
        // Mantiene el catálogo desplazable en la parte superior y ancla una barra fija
        // de total y acción de cobro en la base inferior sin bloquear el scroll.
        return Column(
          children: [
            // Catálogo desplazable en pantalla pequeña
            Expanded(
              child: Scrollbar(
                controller: catalogScrollController,
                child: catalogArea,
              ),
            ),

            // Región fija inferior de resumen de cuenta
            Container(
              decoration: const BoxDecoration(
                color: Color(0xFF1C1917),
                border: Border(top: BorderSide(color: Color(0xFF292524))),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black45,
                    blurRadius: 8,
                    offset: Offset(0, -2),
                  )
                ],
              ),
              child: SafeArea(
                top: false,
                child: paymentPanel,
              ),
            ),
          ],
        );
      },
    );
  }
}
