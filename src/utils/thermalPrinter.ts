/**
 * Módulo de Impresión Térmica Optimizada para POS 90 Grados
 * Soporta papel de 80mm (ancho estándar ESC/POS) y utiliza las reglas de @media print de index.css.
 * Restaurante-Bar 90 Grados · Cundinamarca, Colombia
 */

import { Order, PaymentRecord, RestaurantConfig, ShiftSession } from '../types';
import { formatCOP, formatDateTimeBogota } from './format';

export interface ThermalReceiptOptions {
  paperWidthMm?: 80 | 58;
  title?: string;
  autoCutFeed?: boolean;
}

/**
 * Función principal de impresión térmica:
 * Crea un contenedor efímero aislado con clases térmicas (.thermal-ticket-80mm),
 * ejecuta window.print() con los estilos optimizados de index.css y limpia el DOM al terminar.
 */
export function executeThermalPrint(htmlContent: string, options: ThermalReceiptOptions = {}): void {
  const paperWidth = options.paperWidthMm || 80;
  
  // Limpiar impresiones previas si existieran
  const existing = document.getElementById('thermal-print-container');
  if (existing) {
    existing.remove();
  }

  // Crear contenedor de impresión térmica
  const printContainer = document.createElement('div');
  printContainer.id = 'thermal-print-container';
  printContainer.className = `thermal-ticket-${paperWidth}mm`;
  printContainer.innerHTML = htmlContent;

  document.body.appendChild(printContainer);

  // Agregar clase al body para indicar modo impresión térmica
  document.body.classList.add('printing-thermal');

  // Ejecutar impresión
  setTimeout(() => {
    window.print();
    
    // Limpieza tras imprimir o cancelar
    setTimeout(() => {
      printContainer.remove();
      document.body.classList.remove('printing-thermal');
    }, 500);
  }, 100);
}

/**
 * Imprime comprobante de pago de cliente en papel térmico de 80mm
 */
export function printCustomerReceipt80mm(
  order: Order,
  payment: PaymentRecord,
  config: RestaurantConfig,
  options: ThermalReceiptOptions = {}
): void {
  const paperWidth = options.paperWidthMm || 80;

  const itemsHtml = order.items.map(item => `
    <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
      <span style="font-weight: bold; max-width: 65%; word-break: break-word;">${item.quantity}x ${item.productName}</span>
      <span style="font-family: monospace;">${formatCOP(item.price * item.quantity)}</span>
    </div>
    ${item.notes ? `<div style="font-size: 9px; font-style: italic; margin-left: 8px; margin-bottom: 2px;">* ${item.notes}</div>` : ''}
  `).join('');

  const methodsHtml = payment.methods.map(m => `
    <div style="display: flex; justify-content: space-between; font-size: 10px;">
      <span style="text-transform: capitalize;">${m.method}:</span>
      <span>${formatCOP(m.amount)}</span>
    </div>
  `).join('');

  const billsSummary = Object.entries(payment.cashDenominations || {})
    .filter(([_, count]) => count > 0)
    .map(([denom, count]) => `${count}x $${Number(denom).toLocaleString('es-CO')}`)
    .join(' + ');

  const html = `
    <div style="text-align: center; margin-bottom: 6px;">
      <div style="font-size: 15px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase;">
        ${config.businessName}
      </div>
      <div style="font-size: 10px;">NIT: ${config.nit}</div>
      <div style="font-size: 9px;">${config.municipality} · Tel: ${config.phone}</div>
      <div style="font-size: 9px;">${config.address}</div>
    </div>

    <div class="thermal-divider"></div>

    <div style="display: flex; justify-content: space-between; font-size: 10px;">
      <span><strong>ORDEN #${order.orderNumber}</strong></span>
      <span><strong>${order.tableNumber}</strong></span>
    </div>
    <div style="font-size: 10px;">Fecha: ${formatDateTimeBogota(payment.paidAt)}</div>
    <div style="font-size: 10px;">Cajero: ${payment.cashierName} (@${order.waiterName.split(' ')[0]})</div>

    <div class="thermal-divider"></div>

    <div style="margin: 4px 0;">
      <div style="display: flex; justify-content: space-between; font-size: 10px; font-weight: bold; margin-bottom: 4px;">
        <span>CANT / DESCRIPCIÓN</span>
        <span>TOTAL</span>
      </div>
      ${itemsHtml}
    </div>

    <div class="thermal-divider-double"></div>

    <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 900; margin: 4px 0;">
      <span>TOTAL PAGADO:</span>
      <span>${formatCOP(payment.totalDue)}</span>
    </div>

    <div class="thermal-divider"></div>

    <div style="font-size: 10px; margin: 4px 0;">
      <div style="font-weight: bold; margin-bottom: 2px;">Desglose de Pago:</div>
      ${methodsHtml}
      ${payment.receivedCash > 0 ? `
        <div style="display: flex; justify-content: space-between; margin-top: 2px;">
          <span>Efectivo Recibido:</span>
          <span>${formatCOP(payment.receivedCash)}</span>
        </div>
        ${billsSummary ? `<div style="font-size: 9px; color: #444;">(${billsSummary})</div>` : ''}
        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 12px; margin-top: 2px;">
          <span>VUELTO / CAMBIO:</span>
          <span>${formatCOP(payment.changeGiven)}</span>
        </div>
      ` : ''}
    </div>

    <div class="thermal-divider"></div>

    <div style="text-align: center; margin-top: 6px; font-size: 9px;">
      <div>¡Gracias por su visita a 90 Grados!</div>
      <div>Comprobante Interno de Venta POS (80mm)</div>
      <div style="margin-top: 4px; font-size: 8px;">Sistema Local-First · Zona Horaria: America/Bogota</div>
    </div>

    <!-- Espacio para la guillotina / corte de papel -->
    <div class="thermal-feed-cut"></div>
  `;

  executeThermalPrint(html, { paperWidthMm: paperWidth });
}

/**
 * Imprime comanda de cocina o bar en papel térmico de 80mm
 */
export function printStationComanda80mm(
  order: Order,
  station: 'cocina' | 'bar',
  waiterUsername: string
): void {
  const stationTitle = station === 'cocina' ? 'COMANDA DE COCINA' : 'COMANDA DE BAR';
  const stationItems = order.items.filter(i => i.station === station);

  if (stationItems.length === 0) return;

  const itemsHtml = stationItems.map(item => `
    <div style="margin-bottom: 6px;">
      <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 900;">
        <span>${item.quantity} x ${item.productName}</span>
      </div>
      ${item.notes ? `
        <div style="font-size: 12px; font-weight: bold; margin-left: 8px; border-left: 2px solid black; padding-left: 4px;">
          ★ NOTA: ${item.notes}
        </div>
      ` : ''}
    </div>
  `).join('');

  const html = `
    <div style="text-align: center; margin-bottom: 4px;">
      <div style="font-size: 18px; font-weight: 900; text-transform: uppercase;">
        *** ${stationTitle} ***
      </div>
    </div>

    <div class="thermal-divider-double"></div>

    <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 900;">
      <span>${order.tableNumber}</span>
      <span>ORDEN #${order.orderNumber}</span>
    </div>
    <div style="font-size: 10px; margin-top: 2px;">
      Hora: ${formatDateTimeBogota(order.createdAt).split(',')[1]} · Mesero: @${waiterUsername}
    </div>

    ${order.customerNote ? `
      <div style="margin: 4px 0; padding: 4px; border: 1px dashed black; font-size: 11px; font-weight: bold;">
        OBSERVACIÓN: ${order.customerNote}
      </div>
    ` : ''}

    <div class="thermal-divider"></div>

    <div style="margin: 6px 0;">
      ${itemsHtml}
    </div>

    <div class="thermal-divider"></div>

    <div style="text-align: center; font-size: 10px; font-weight: bold;">
      -- FIN DE COMANDA (${stationItems.length} platos/bebidas) --
    </div>

    <div class="thermal-feed-cut"></div>
  `;

  executeThermalPrint(html, { paperWidthMm: 80 });
}

/**
 * Imprime reporte de Cierre Z en papel térmico de 80mm
 */
export function printShiftZReport80mm(
  shift: ShiftSession,
  config: RestaurantConfig
): void {
  const html = `
    <div style="text-align: center; margin-bottom: 6px;">
      <div style="font-size: 15px; font-weight: 900; text-transform: uppercase;">
        ${config.businessName}
      </div>
      <div style="font-size: 11px; font-weight: bold;">CIERRE Z FINAL DE CAJA (80mm)</div>
      <div style="font-size: 9px;">NIT: ${config.nit} · ${config.municipality}</div>
    </div>

    <div class="thermal-divider-double"></div>

    <div style="font-size: 10px;">
      <div><strong>Centro:</strong> ${shift.center}</div>
      <div><strong>ID Turno:</strong> ${shift.id}</div>
      <div><strong>Apertura:</strong> ${formatDateTimeBogota(shift.openedAt)}</div>
      <div><strong>Cierre Z:</strong> ${formatDateTimeBogota(shift.closedAt)}</div>
      <div><strong>Responsable:</strong> ${shift.closedByUserName || shift.openedByUserName}</div>
    </div>

    <div class="thermal-divider"></div>

    <div style="font-size: 11px; margin: 4px 0;">
      <div style="display: flex; justify-content: space-between;">
        <span>Fondo Inicial:</span>
        <span>${formatCOP(shift.initialFund)}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>Ventas Efectivo:</span>
        <span>+ ${formatCOP(shift.totalSalesCash)}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>Ventas Electrónicas:</span>
        <span>${formatCOP(shift.totalSalesElectronic)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 12px; margin-top: 2px;">
        <span>VENTAS TOTALES:</span>
        <span>${formatCOP(shift.totalSalesTotal)}</span>
      </div>
    </div>

    <div class="thermal-divider-double"></div>

    <div style="font-size: 11px; margin: 4px 0;">
      <div style="display: flex; justify-content: space-between;">
        <span>Efectivo Esperado:</span>
        <span>${formatCOP(shift.expectedCash)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-weight: bold;">
        <span>Efectivo Contado:</span>
        <span>${formatCOP(shift.countedCash)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 12px; margin-top: 2px;">
        <span>DIFERENCIA:</span>
        <span>${formatCOP(shift.cashDifference)}</span>
      </div>
    </div>

    ${shift.transferHandover ? `
      <div class="thermal-divider"></div>
      <div style="font-size: 10px;">
        <div><strong>TRASPASO DE TURNO (RELEVO):</strong></div>
        <div>Entregado a: ${shift.transferHandover.toUserName}</div>
        <div>Fondo Verificado: ${formatCOP(shift.transferHandover.verifiedFund)}</div>
        ${shift.transferHandover.notes ? `<div>Nota: ${shift.transferHandover.notes}</div>` : ''}
      </div>
    ` : ''}

    <div class="thermal-divider"></div>

    <div style="text-align: center; margin-top: 15px;">
      <div style="border-top: 1px solid black; width: 80%; margin: 0 auto; padding-top: 2px; font-size: 9px;">
        Firma Responsable Saliente
      </div>
    </div>

    <div class="thermal-feed-cut"></div>
  `;

  executeThermalPrint(html, { paperWidthMm: 80 });
}
