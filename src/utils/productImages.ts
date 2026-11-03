/**
 * Curated high-resolution culinary photography mapping for 90 Grados POS catalog.
 * Provides authentic visual representation for Colombian dishes, fast food, meats,
 * beverages and house specialties, matching the UI design reference.
 */

const PRODUCT_IMAGE_MAP: Record<string, string> = {
  // Comidas Rápidas - Salchipapas
  'CR-001': 'https://images.unsplash.com/photo-1585109649139-366815a0d713?auto=format&fit=crop&w=600&q=80', // Salchipapa sencilla
  'CR-002': 'https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=600&q=80', // Salchipapa especial

  // Alitas BBQ
  'CR-003': 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?auto=format&fit=crop&w=600&q=80', // Alitas BBQ 4
  'CR-004': 'https://images.unsplash.com/photo-1527477378408-1bc09a473453?auto=format&fit=crop&w=600&q=80', // Alitas BBQ 10

  // Patacones
  'CR-005': 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80', // Patacón mixto
  'CR-006': 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80', // Patacón especial

  // Hamburguesas
  'CR-007': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80', // Hamburguesa artesanal / sencilla
  'CR-008': 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=600&q=80', // Hamburguesa doble
  'CR-009': 'https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?auto=format&fit=crop&w=600&q=80', // Hamburguesa con tocineta
  'CR-010': 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80', // Hamburguesa de pollo
  'CR-011': 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=600&q=80', // Hamburguesa de la casa

  // Perros Calientes
  'CR-012': 'https://images.unsplash.com/photo-1619740455993-9e612b1af08a?auto=format&fit=crop&w=600&q=80', // Perro sencillo
  'CR-013': 'https://images.unsplash.com/photo-1627054234033-d7374a2ff761?auto=format&fit=crop&w=600&q=80', // Perro especial

  // Picadas
  'PIC-001': 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80', // Picada 90 Grados
  'PIC-002': 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80', // Picada Criolla

  // Carnes al carbón
  'CAR-001': 'https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=600&q=80', // Churrasco
  'CAR-002': 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80', // Punta de Anca
  'CAR-003': 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80', // Costillas BBQ

  // Pescados
  'PES-001': 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=600&q=80', // Mojarra frita
  'PES-002': 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=600&q=80', // Filete de trucha

  // Cervezas
  'CER-001': 'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=600&q=80', // Club Colombia
  'CER-002': 'https://images.unsplash.com/photo-1618886614638-80e3c153d31a?auto=format&fit=crop&w=600&q=80', // Corona
  'CER-003': 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?auto=format&fit=crop&w=600&q=80', // Poker

  // Licores
  'LIC-001': 'https://images.unsplash.com/photo-1527281400683-1aae777175f8?auto=format&fit=crop&w=600&q=80', // Aguardiente Antioqueño
  'LIC-002': 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=600&q=80', // Ron Medellín
  'LIC-003': 'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?auto=format&fit=crop&w=600&q=80', // Whisky Buchanans

  // Jugos y bebidas frías
  'JUG-001': 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80', // Jugos naturales
  'BEB-001': 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80', // Gaseosa Coca Cola
};

const CATEGORY_DEFAULT_IMAGES: Record<string, string> = {
  'Comidas Rápidas': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80',
  'Picadas': 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80',
  'Carnes': 'https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=600&q=80',
  'Platos en Salsa': 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
  'Pescados': 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=600&q=80',
  'Aves': 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?auto=format&fit=crop&w=600&q=80',
  'Desayunos': 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=600&q=80',
  'Jugos Naturales': 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80',
  'Cervezas': 'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=600&q=80',
  'Licores': 'https://images.unsplash.com/photo-1527281400683-1aae777175f8?auto=format&fit=crop&w=600&q=80',
  'Bebidas Frías': 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80',
};

export function getProductImageUrl(sku: string, category: string, name?: string): string {
  if (PRODUCT_IMAGE_MAP[sku]) {
    return PRODUCT_IMAGE_MAP[sku];
  }

  // Fallback by name heuristics
  if (name) {
    const lower = name.toLowerCase();
    if (lower.includes('hamburguesa')) return PRODUCT_IMAGE_MAP['CR-007'];
    if (lower.includes('alita')) return PRODUCT_IMAGE_MAP['CR-003'];
    if (lower.includes('salchipapa')) return PRODUCT_IMAGE_MAP['CR-001'];
    if (lower.includes('patac')) return PRODUCT_IMAGE_MAP['CR-005'];
    if (lower.includes('perro')) return PRODUCT_IMAGE_MAP['CR-012'];
    if (lower.includes('cerveza') || lower.includes('club') || lower.includes('corona') || lower.includes('poker')) return PRODUCT_IMAGE_MAP['CER-001'];
    if (lower.includes('aguardiente') || lower.includes('ron') || lower.includes('whisky')) return PRODUCT_IMAGE_MAP['LIC-001'];
    if (lower.includes('jugo')) return PRODUCT_IMAGE_MAP['JUG-001'];
    if (lower.includes('carne') || lower.includes('churrasco') || lower.includes('costilla')) return PRODUCT_IMAGE_MAP['CAR-001'];
    if (lower.includes('pescado') || lower.includes('mojarra') || lower.includes('trucha')) return PRODUCT_IMAGE_MAP['PES-001'];
  }

  return CATEGORY_DEFAULT_IMAGES[category] || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80';
}
