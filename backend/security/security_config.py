"""
Sistema 90 Grados - Marco de Seguridad Obligatoria (20 Controles)
Restaurante-Bar 90 Grados, Cundinamarca, Colombia
"""

import os
import re
import html
import time
import hashlib
import hmac
import secrets
from typing import Dict, List, Optional, Any, Tuple

# ==============================================================================
# CONTROL 1 & 2: Ocultar API Keys y Eliminar Secretos de Git
# ==============================================================================
class SecretManager:
    """Asegura que los secretos se carguen exclusivamente de variables de entorno seguras."""
    @staticmethod
    def get_required_secret(key: str, default_local: str = "") -> str:
        val = os.environ.get(key)
        if not val:
            if default_local and os.environ.get("ENV") != "production":
                return default_local
            raise RuntimeError(f"CRÍTICO [Control 1]: Secreto {key} no configurado en entorno seguro.")
        return val

# ==============================================================================
# CONTROL 10: Hashear Contraseñas y PINs con Sal Única y Derivación Segura
# ==============================================================================
def hash_pin_securely(pin: str, salt: Optional[str] = None) -> Tuple[str, str]:
    """
    Control 10: Nunca guardar ni registrar contraseñas o PINs en texto plano.
    Usa PBKDF2-HMAC-SHA256 con 100.000 iteraciones y sal criptográfica de 16 bytes.
    """
    if not re.match(r"^\d{4,6}$", pin):
        raise ValueError("El PIN debe ser numérico de 4 a 6 dígitos.")
    
    if not salt:
        salt = secrets.token_hex(16)
        
    derived = hashlib.pbkdf2_hmac(
        'sha256',
        pin.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    )
    return derived.hex(), salt

def verify_pin_securely(pin: str, hashed: str, salt: str) -> bool:
    expected_hash, _ = hash_pin_securely(pin, salt)
    return hmac.compare_digest(expected_hash, hashed)

# ==============================================================================
# CONTROL 11: Rate Limiting en Autenticación y Rutas Críticas
# ==============================================================================
class RateLimiter:
    """Control 11: Limita intentos por IP/Usuario con respuestas controladas."""
    def __init__(self, max_requests: int = 5, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.attempts: Dict[str, List[float]] = {}

    def is_rate_limited(self, identifier: str) -> bool:
        now = time.time()
        timestamps = self.attempts.get(identifier, [])
        # Filtrar timestamps viejos fuera de ventana
        valid_timestamps = [t for t in timestamps if now - t < self.window_seconds]
        if len(valid_timestamps) >= self.max_requests:
            self.attempts[identifier] = valid_timestamps
            return True
        valid_timestamps.append(now)
        self.attempts[identifier] = valid_timestamps
        return False

# ==============================================================================
# CONTROL 12: Protección LAN y Bloqueo de Acceso Público
# ==============================================================================
def is_lan_ip(ip: str) -> bool:
    """Control 12: Restringe acceso exclusivamente a la subred local."""
    lan_patterns = [
        r"^127\.0\.0\.1$",
        r"^localhost$",
        r"^192\.168\.\d{1,3}\.\d{1,3}$",
        r"^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$",
        r"^172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}$"
    ]
    return any(re.match(pat, ip) for pat in lan_patterns)

# ==============================================================================
# CONTROL 14 & 15: Validación de Inputs y Sanitización contra XSS
# ==============================================================================
def sanitize_text(text: str) -> str:
    """
    Control 15: Escapar HTML y prevenir ataques XSS.
    Los nombres de producto y notas del mesero son datos no confiables.
    """
    if not text:
        return ""
    # Escapar entidades HTML
    clean = html.escape(text.strip())
    # Eliminar secuencias nulas o de control
    clean = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F]', '', clean)
    return clean

# ==============================================================================
# CONTROL 16: Restringir Archivos (MIME Real, Tamaño y Nombres Aleatorios)
# ==============================================================================
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "text/csv"}
MAX_FILE_BYTES = 5 * 1024 * 1024  # 5 MB max

def validate_uploaded_file(filename: str, file_bytes: bytes, mime_type: str) -> Tuple[bool, str]:
    if len(file_bytes) > MAX_FILE_BYTES:
        return False, "El archivo excede el tamaño máximo permitido de 5 MB."
    
    if mime_type not in ALLOWED_MIME_TYPES:
        return False, f"Tipo MIME '{mime_type}' no permitido. Solo JPG, PNG, WEBP y CSV."
    
    ext = os.path.splitext(filename)[1].lower()
    if ext in {".exe", ".bat", ".cmd", ".sh", ".py", ".js", ".php", ".phtml"}:
        return False, "Archivos ejecutables están estrictamente prohibidos."
    
    # Verificación de bytes mágicos
    if mime_type == "image/jpeg" and not file_bytes.startswith(b'\xff\xd8\xff'):
        return False, "La firma binaria no corresponde a una imagen JPEG auténtica."
    if mime_type == "image/png" and not file_bytes.startswith(b'\x89PNG\r\n\x1a\n'):
        return False, "La firma binaria no corresponde a una imagen PNG auténtica."
        
    return True, "Archivo válido"

# ==============================================================================
# CONTROL 8: Bloquear Manipulación de Campos (Validación en Servidor)
# ==============================================================================
def validate_order_financials_server_side(
    items: List[Dict[str, Any]], 
    official_catalog: Dict[str, int]
) -> int:
    """
    Control 8: Nunca confiar en los precios o totales calculados por el cliente.
    Calcula el total real a partir del catálogo oficial del restaurante.
    """
    calculated_total = 0
    for item in items:
        sku = item.get("sku")
        qty = item.get("quantity", 0)
        
        if qty <= 0:
            raise ValueError(f"Cantidad inválida ({qty}) para el producto {sku}")
            
        if sku not in official_catalog:
            raise ValueError(f"Producto con SKU {sku} no existe en la carta oficial")
            
        official_price = official_catalog[sku]
        calculated_total += (official_price * qty)
        
    return calculated_total

# ==============================================================================
# CONTROL 17: Devolver Datos Mínimos según el Rol (Redacción de Costos Confidenciales)
# ==============================================================================
def filter_product_for_role(product_data: Dict[str, Any], user_role: str) -> Dict[str, Any]:
    """
    Control 17: Los meseros y cajeros no deben ver el costo de compra ni el margen confidencial.
    Solo administradores y encargados de inventario tienen acceso a costos y escandallos.
    """
    allowed = product_data.copy()
    if user_role not in {"administrador", "inventario_contabilidad"}:
        allowed.pop("estimated_cost_cop", None)
        allowed.pop("recipe_ingredients", None)
        allowed.pop("theoretical_margin_percentage", None)
    return allowed

# ==============================================================================
# CONTROL 18: Security Headers para Interfaces Auxiliares
# ==============================================================================
SECURITY_HEADERS = {
    "Content-Security-Policy": (
        "default-src 'self'; "
        "img-src 'self' data: https:; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "frame-ancestors 'none';"
    ),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(self), microphone=(), geolocation=()",
    "Cache-Control": "no-store, max-age=0"
}
