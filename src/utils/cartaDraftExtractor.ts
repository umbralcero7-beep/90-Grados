/**
 * Utilidad de Borrador de Carta y Plantilla de Revisión - 90 Grados POS
 * Ejecución en navegador/Electron sin alterar carta activa hasta aprobación humana.
 */

export interface CartaDraftItemUI {
  skuSugerido: string;
  nombre: string;
  categoria: string;
  precioCOP: number | null;
  estacion: 'cocina' | 'bar';
  descripcion: string;
  unidad: string;
  estadoRevision: 'pendiente_revision' | 'verificado' | 'rechazado';
  advertencias: string[];
  esComboOVariante: boolean;
}

export interface CartaDraftReportUI {
  totalItems: number;
  itemsClaros: number;
  itemsConAdvertencia: number;
  bloqueadoParaPublicacion: boolean;
  mensajeAuditoria: string;
  items: CartaDraftItemUI[];
}

export function parseCartaFromCsvClient(csvText: string, filename = "carta_revision.csv"): CartaDraftReportUI {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
  const items: CartaDraftItemUI[] = [];
  let lineNo = 0;

  for (const rawLine of lines) {
    lineNo++;
    // Separar por comas respetando comillas simples si existen
    const row = rawLine.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (!row || row.length === 0 || !row[0]) continue;

    // Detectar cabecera
    if (lineNo === 1 && (row[0].toLowerCase().includes('nombre') || row[0].toLowerCase().includes('producto'))) {
      continue;
    }

    const nombre = row[0] || 'Sin Nombre';
    const categoria = row[1] || 'Comidas Rápidas';
    const precioRaw = row[2] || '';
    const descripcion = row[3] || '';
    const unidad = row[4] || 'unidad';
    const estacionRaw = (row[5] || '').toLowerCase();

    const advertencias: string[] = [];

    // Validar precio
    let precioCOP: number | null = null;
    if (!precioRaw) {
      advertencias.push('Precio ausente en documento.');
    } else {
      if (precioRaw.includes('/') || precioRaw.includes('-') || precioRaw.toLowerCase().includes(' o ')) {
        advertencias.push('Precios múltiples o variantes detectadas (ej. 15.000 / 28.000).');
      }
      const digitos = precioRaw.replace(/[^\d]/g, '');
      if (!digitos) {
        advertencias.push(`Valor '${precioRaw}' no contiene dígitos numéricos válidos.`);
      } else {
        precioCOP = parseInt(digitos, 10);
        if (precioCOP < 500) {
          advertencias.push(`Importe sospechosamente bajo ($${precioCOP} COP).`);
        } else if (precioCOP > 5000000) {
          advertencias.push(`Importe inusualmente alto ($${precioCOP} COP).`);
        }
      }
    }

    const esCombo = /combo|familiar|promoci[oó]n|2x1|\+/i.test(nombre);
    if (esCombo) {
      advertencias.push('Detectado posible combo o paquete promocional. Verificar insumos.');
    }

    const estacion = (estacionRaw === 'bar' || /cerveza|licor|bebida|jugo|trago|coctel/i.test(categoria) || /poker|aguila|ron|whisky|gaseosa/i.test(nombre))
      ? 'bar'
      : 'cocina';

    items.push({
      skuSugerido: `DRAFT-${categoria.slice(0, 3).toUpperCase()}-${String(lineNo).padStart(3, '0')}`,
      nombre,
      categoria,
      precioCOP,
      estacion,
      descripcion,
      unidad,
      estadoRevision: 'pendiente_revision',
      advertencias,
      esComboOVariante: esCombo
    });
  }

  const claros = items.filter(it => it.advertencias.length === 0 && it.precioCOP !== null).length;
  const conAdv = items.length - claros;

  return {
    totalItems: items.length,
    itemsClaros: claros,
    itemsConAdvertencia: conAdv,
    bloqueadoParaPublicacion: true, // ESTRICTAMENTE BLOQUEADO
    mensajeAuditoria: `Borrador procesado (${filename}). ${items.length} productos listos para revisión humana. Ningún plato añadido a la carta activa.`,
    items
  };
}

export function downloadCartaCsvTemplate(): void {
  const content = [
    'Nombre del Producto,Categoría,Precio COP,Descripción / Acompañamientos,Unidad de Venta,Estación (cocina/bar)',
    '"Picada 90 Grados 2 Personas","Picadas","48000","Carne de res, cerdo, chicharrón, papa criolla y arepa","porción","cocina"',
    '"Costillas BBQ al Carbón","Carnes","38000","Costilla de cerdo horneada y dorada al carbón","plato","cocina"',
    '"Cerveza Poker 330ml","Cervezas","6000","Botella retornable bien fría","unidad","bar"',
    '"Aguardiente Antioqueño Media","Licores","45000","Media botella 375ml con copas","media","bar"',
    '"Limonada Natural Fría","Bebidas Frías","7000","Vaso de jugo natural refrescante","vaso","bar"'
  ].join('\n');

  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'plantilla_revision_carta_90grados.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
