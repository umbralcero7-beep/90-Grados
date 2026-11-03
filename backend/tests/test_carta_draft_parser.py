"""
Suite de Pruebas del Extractor de Carta en Borrador - 90 Grados
Valida importación segura en modo borrador, detección de ambigüedades,
bloqueo de auto-publicación y generación de plantilla CSV.
"""

import os
import unittest
from backend.services.pdf_carta_extractor import (
    parse_carta_from_csv_text,
    generate_revision_csv_template,
    limpiar_precio_cop
)

class TestCartaDraftParser(unittest.TestCase):

    def setUp(self):
        self.fixtures_dir = os.path.join(os.path.dirname(__file__), "fixtures")
        self.synthetic_csv_path = os.path.join(self.fixtures_dir, "sample_carta_synthetic.csv")
        self.ambiguous_csv_path = os.path.join(self.fixtures_dir, "sample_carta_synthetic_ambiguous.csv")

    def test_importacion_borrador_limpio_no_publica_automaticamente(self):
        """El reporte debe estar bloqueado para publicación directa hasta revisión humana."""
        with open(self.synthetic_csv_path, "r", encoding="utf-8") as f:
            content = f.read()

        reporte = parse_carta_from_csv_text(content, filename="sample_carta_synthetic.csv")

        self.assertEqual(reporte.total_items_extraidos, 8)
        self.assertEqual(reporte.items_claros, 8)
        self.assertEqual(reporte.items_con_advertencia, 0)
        # REGLA CRÍTICA: Bloqueado para publicación directa
        self.assertTrue(reporte.bloqueado_para_publicacion)
        for it in reporte.items:
            self.assertEqual(it.estado_revision, "pendiente_revision")

    def test_deteccion_de_ambiguedades_y_variantes(self):
        """Casos ambiguos (precios múltiples, texto no numérico, combos) deben ser marcados."""
        with open(self.ambiguous_csv_path, "r", encoding="utf-8") as f:
            content = f.read()

        reporte = parse_carta_from_csv_text(content, filename="sample_carta_synthetic_ambiguous.csv")

        self.assertEqual(reporte.total_items_extraidos, 6)
        self.assertGreater(reporte.items_con_advertencia, 0)
        self.assertTrue(reporte.bloqueado_para_publicacion)

        # Buscar el item con variante de precio '65000 / 95000'
        picada = next((it for it in reporte.items if "Picada Familiar" in it.nombre), None)
        self.assertIsNotNone(picada)
        self.assertTrue(any("variantes" in w.lower() for w in picada.advertencias))

        # Buscar el plato con precio 'Consultar'
        plato_dia = next((it for it in reporte.items if "Plato del Día" in it.nombre), None)
        self.assertIsNotNone(plato_dia)
        self.assertIsNone(plato_dia.precio_cop)
        self.assertTrue(any("numéricos" in w.lower() for w in plato_dia.advertencias))

        # Buscar el combo
        combo = next((it for it in reporte.items if "Combo" in it.nombre), None)
        self.assertIsNotNone(combo)
        self.assertTrue(combo.es_combo_o_variante)

        # Buscar el item con precio vacío
        artesanal = next((it for it in reporte.items if "Ilegible" in it.nombre), None)
        self.assertIsNotNone(artesanal)
        self.assertIsNone(artesanal.precio_cop)

    def test_plantilla_csv_revision_disponible(self):
        """Verifica que la plantilla CSV para revisión humana se genere correctamente."""
        template = generate_revision_csv_template()
        self.assertIn("Nombre del Producto", template)
        self.assertIn("Categoría", template)
        self.assertIn("Precio COP", template)
        self.assertIn("Picada 90 Grados", template)

    def test_limpieza_precios_conserva_valores_exactos(self):
        """Valida que los precios exactos en COP no sufran alteraciones."""
        precio, warns = limpiar_precio_cop("$ 45.000")
        self.assertEqual(precio, 45000)
        self.assertEqual(len(warns), 0)

        precio2, warns2 = limpiar_precio_cop("6000")
        self.assertEqual(precio2, 6000)
        self.assertEqual(len(warns2), 0)

if __name__ == '__main__':
    unittest.main()
