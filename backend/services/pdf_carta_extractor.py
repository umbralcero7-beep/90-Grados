"""
Sistema de Punto de Venta (POS) - 90 Grados
Extractor y Validador de Borrador de Carta desde PDF / CSV
Restaurante-Bar 90 Grados, Cundinamarca, Colombia

Reglas obligatorias:
1. El archivo se procesa estrictamente en modo BORRADOR REVISABLE (draft).
2. NO se publican automáticamente productos en la carta activa.
3. Se conservan precios exactos sin redondeos arbitrarios.
4. Se marcan importes ambiguos, variantes, combos o texto dudoso con 'requiere_revision: true'.
5. Si no se puede procesar el PDF (ej. archivo ausente, escaneo ilegible o sin OCR), se genera
   y exporta el formato de revisión CSV estándar para que el administrador revise antes de incorporar.
"""

import os
import re
import csv
import io
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional, Tuple, Any

@dataclass
class CartaDraftItem:
    sku_sugerido: str
    nombre: str
    categoria: str
    precio_cop: Optional[int]
    estacion: str  # 'cocina' o 'bar'
    descripcion: str
    unidad: str
    estado_revision: str  # 'pendiente_revision', 'verificado', 'rechazado'
    advertencias: List[str] = field(default_factory=list)
    es_combo_o_variante: bool = False
    texto_crudo_origen: str = ""

@dataclass
class CartaDraftExtractionReport:
    total_items_extraidos: int
    items_claros: int
    items_con_advertencia: int
    origen_archivo: str
    tipo_procesamiento: str  # 'pdf_texto', 'pdf_ocr_pendiente', 'csv_estructurado'
    bloqueado_para_publicacion: bool
    mensaje_auditoria: str
    items: List[CartaDraftItem] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_items_extraidos": self.total_items_extraidos,
            "items_claros": self.items_claros,
            "items_con_advertencia": self.items_con_advertencia,
            "origen_archivo": self.origen_archivo,
            "tipo_procesamiento": self.tipo_procesamiento,
            "bloqueado_para_publicacion": self.bloqueado_para_publicacion,
            "mensaje_auditoria": self.mensaje_auditoria,
            "items": [asdict(it) for it in self.items]
        }


# Categorías conocidas del restaurante 90 Grados
CATEGORIAS_CONOCIDAS = [
    "Comidas Rápidas", "Picadas", "Carnes", "Platos en Salsa",
    "Pescados", "Aves", "Desayunos", "Jugos Naturales",
    "Cervezas", "Licores", "Bebidas Frías"
]

def clasificar_estacion(categoria: str, nombre: str) -> str:
    cat_lower = categoria.lower()
    nom_lower = nombre.lower()
    if any(k in cat_lower for k in ["cerveza", "licor", "bebida", "jugo", "trago", "coctel"]):
        return "bar"
    if any(k in nom_lower for k in ["poker", "aguila", "heineken", "club colombia", "whisky", "ron", "aguardiente", "gaseosa", "limonada"]):
        return "bar"
    return "cocina"

def limpiar_precio_cop(texto_precio: str) -> Tuple[Optional[int], List[str]]:
    """Extrae y valida el precio entero en COP conservando fidelidad absoluta."""
    advertencias = []
    if not texto_precio:
        advertencias.append("Precio ausente en documento de origen.")
        return None, advertencias

    # Detectar variantes separadas por slash o guion ej: 15.000 / 28.000
    if "/" in texto_precio or "-" in texto_precio or " o " in texto_precio:
        advertencias.append("Precios múltiples o variantes detectadas (ej. personal vs familiar). Requiere revisión.")
    
    # Extraer dígitos
    digitos = re.sub(r"[^\d]", "", texto_precio)
    if not digitos:
        advertencias.append(f"No se pudieron extraer dígitos numéricos de '{texto_precio}'.")
        return None, advertencias

    try:
        precio = int(digitos)
        # En Colombia, precios de platos suelen ser >= 1.000 COP
        if precio < 500:
            advertencias.append(f"Importe sospechosamente bajo (${precio} COP). Verificar decimales o escala.")
        elif precio > 5000000:
            advertencias.append(f"Importe inusualmente alto (${precio} COP). Posible error tipográfico.")
        return precio, advertencias
    except ValueError:
        advertencias.append(f"Valor numérico no convertible: '{texto_precio}'.")
        return None, advertencias


def parse_carta_from_csv_text(csv_text: str, filename: str = "carta_revision.csv") -> CartaDraftExtractionReport:
    """Parsea una carta estructurada desde CSV garantizando que quede en borrador para revisión humana."""
    f = io.StringIO(csv_text.strip())
    reader = csv.reader(f)
    
    items: List[CartaDraftItem] = []
    line_no = 0
    headers = []

    for row in reader:
        line_no += 1
        if not row or not any(row):
            continue
        
        # Detectar cabecera
        if line_no == 1 and any("nombre" in c.lower() or "producto" in c.lower() for c in row):
            headers = [c.strip().lower() for c in row]
            continue
        
        # Mapeo posicional o por cabecera
        nombre = row[0].strip() if len(row) > 0 else "Sin Nombre"
        categoria = row[1].strip() if len(row) > 1 else "Comidas Rápidas"
        precio_raw = row[2].strip() if len(row) > 2 else ""
        descripcion = row[3].strip() if len(row) > 3 else ""
        unidad = row[4].strip() if len(row) > 4 else "unidad"

        precio_cop, warns = limpiar_precio_cop(precio_raw)
        
        es_combo = any(k in nombre.lower() for k in ["combo", "picada x", "familiar", "promoción", "2x1", "+"])
        if es_combo:
            warns.append("Detectado posible combo o paquete promocional. Verificar insumos/escandallos.")

        sku_sug = f"DRAFT-{categoria[:3].upper()}-{line_no:03d}"
        estacion = clasificar_estacion(categoria, nombre)

        items.append(CartaDraftItem(
            sku_sugerido=sku_sug,
            nombre=nombre,
            categoria=categoria,
            precio_cop=precio_cop,
            estacion=estacion,
            descripcion=descripcion,
            unidad=unidad,
            estado_revision="pendiente_revision",
            advertencias=warns,
            es_combo_o_variante=es_combo,
            texto_crudo_origen=f"{nombre} | {categoria} | {precio_raw}"
        ))

    claros = sum(1 for it in items if not it.advertencias and it.precio_cop is not None)
    con_adv = len(items) - claros

    return CartaDraftExtractionReport(
        total_items_extraidos=len(items),
        items_claros=claros,
        items_con_advertencia=con_adv,
        origen_archivo=filename,
        tipo_procesamiento="csv_estructurado",
        bloqueado_para_publicacion=True,  # ESTRICTAMENTE BLOQUEADO HASTA REVISIÓN HUMANA
        mensaje_auditoria=f"Borrador extraído de {filename}. {len(items)} registros listos para revisión humana. Ningún producto publicado a la carta activa.",
        items=items
    )


def generate_revision_csv_template() -> str:
    """Genera la plantilla CSV estándar que el restaurante puede completar si el PDF no es legible."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Nombre del Producto", "Categoría", "Precio COP", "Descripción / Acompañamientos", "Unidad de Venta", "Estación (cocina/bar)"])
    writer.writerow(["Picada 90 Grados 2 Personas", "Picadas", "48000", "Carne de res, cerdo, chicharrón, papa criolla y arepa", "porción", "cocina"])
    writer.writerow(["Cerveza Poker 330ml", "Cervezas", "6000", "Botella retornable fría", "unidad", "bar"])
    writer.writerow(["Hamburguesa Artesanal Doble", "Comidas Rápidas", "26000", "Carne angus 200g, queso cheddar, tocineta y papas a la francesa", "unidad", "cocina"])
    writer.writerow(["Limonada de Coco", "Jugos Naturales", "12000", "Bebida frappé con leche de coco natural", "vaso", "bar"])
    return output.getvalue()
